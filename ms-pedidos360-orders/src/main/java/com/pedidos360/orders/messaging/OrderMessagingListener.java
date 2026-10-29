package com.pedidos360.orders.messaging;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pedidos360.orders.dto.OrderResponse;
import com.pedidos360.orders.messaging.unsent.UnsentMessageLog;
import com.pedidos360.orders.model.OrderStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Publica despues del commit y en otro hilo: si Kafka o RabbitMQ estan caidos el pedido igual queda guardado
 * y la API responde (el core no se bloquea). Con app.messaging.enabled=false (perfil local/tests) no publica nada.
 * Con app.kafka.enabled=false se envian igual los comandos a RabbitMQ, pero no se publica en Kafka
 * (despliegue sin cluster Kafka: audit/report no estan levantados).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrderMessagingListener {

	private final KafkaTemplate<String, String> kafkaTemplate;
	private final RabbitTemplate rabbitTemplate;
	private final ObjectMapper objectMapper;
	private final UnsentMessageLog unsentMessages;

	@Value("${app.messaging.enabled:false}")
	private boolean enabled;

	@Value("${app.kafka.enabled:true}")
	private boolean kafkaEnabled;

	@Async("messagingExecutor")
	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
	public void on(OrderEvent event) {
		if (!enabled) {
			log.debug("Mensajeria desactivada, no se publica {} del pedido {}", event.type(), event.orderId());
			return;
		}
		if (kafkaEnabled) {
			publishEvent(event);
		} else {
			log.debug("Kafka desactivado, no se publica {} del pedido {} en {}", event.type(), event.orderId(),
					MessagingConfig.ORDERS_EVENTS_TOPIC);
		}
		sendCommands(event);
	}

	private void publishEvent(OrderEvent event) {
		try {
			String json = objectMapper.writeValueAsString(event);
			kafkaTemplate.send(MessagingConfig.ORDERS_EVENTS_TOPIC, String.valueOf(event.orderId()), json)
					.whenComplete((result, ex) -> {
						if (ex != null) {
							log.error("No se pudo publicar {} del pedido {} en Kafka: {}", event.type(), event.orderId(), ex.getMessage());
						} else {
							log.info("Kafka {} pedido {} -> {}-{}@{}", event.type(), event.orderId(),
									result.getRecordMetadata().topic(), result.getRecordMetadata().partition(),
									result.getRecordMetadata().offset());
						}
					});
		} catch (JsonProcessingException | RuntimeException ex) {
			log.error("Error publicando {} del pedido {} en Kafka", event.type(), event.orderId(), ex);
		}
	}

	private void sendCommands(OrderEvent event) {
		if (OrderEvent.DELETED.equals(event.type()) || OrderEvent.UPDATED.equals(event.type())) {
			return;
		}
		OrderResponse order = event.order();

		// Correo invalido o rechazado: error de datos, va directo a q.cmd.email.dlq sin pasar por q.cmd.email.
		// Cancelaciones salen como prioritarias por el exchange topic (email.# -> q.cmd.email).
		Command email = Command.of("EmailSend", event, emailPayload(event));
		Optional<String> rejected = EmailRecipientCheck.rejectionReason(order.customerEmail());
		if (rejected.isPresent()) {
			sendToDeadLetter(MessagingConfig.Q_EMAIL, MessagingConfig.RK_EMAIL, email, rejected.get());
		} else if (event.status() == OrderStatus.CANCELADO) {
			send(MessagingConfig.CMD_TOPIC, MessagingConfig.RK_EMAIL_HIGH, email);
		} else {
			send(MessagingConfig.CMD_DIRECT, MessagingConfig.RK_EMAIL, email);
		}

		if (event.status() == OrderStatus.ACEPTADO) {
			Map<String, Object> ticket = new LinkedHashMap<>();
			ticket.put("orderId", order.id());
			ticket.put("storeId", order.storeId());
			ticket.put("customerName", order.customerName());
			ticket.put("notes", order.notes());
			ticket.put("items", order.items());
			send(MessagingConfig.CMD_DIRECT, MessagingConfig.RK_KITCHEN, Command.of("KitchenTicket", event, ticket));
		}

		if (event.status() == OrderStatus.ENTREGADO) {
			Map<String, Object> invoice = new LinkedHashMap<>();
			invoice.put("orderId", order.id());
			invoice.put("storeId", order.storeId());
			invoice.put("customerName", order.customerName());
			invoice.put("customerEmail", order.customerEmail());
			invoice.put("total", order.total());
			invoice.put("items", order.items());
			send(MessagingConfig.CMD_TOPIC, MessagingConfig.RK_INVOICE_PDF, Command.of("InvoiceGenerate", event, invoice));
		}

		Map<String, Object> inApp = inAppPayload(event);
		if (inApp != null) {
			send(MessagingConfig.CMD_DIRECT, MessagingConfig.RK_INAPP, Command.of("InAppNotify", event, inApp));
		}
	}

	/**
	 * Notificacion de la campana: pedido nuevo -> administradores; cambio de estado -> el cliente del pedido.
	 * Al confirmar (ACEPTADO) el cliente recibe "tu pedido esta en proceso".
	 */
	public static Map<String, Object> inAppPayload(OrderEvent event) {
		OrderResponse order = event.order();
		if (order == null || event.status() == null) {
			return null;
		}
		Long id = order.id();
		String audience = "CUSTOMER";
		String title;
		String body;
		switch (event.status()) {
			case CREADO -> {
				audience = "ADMIN";
				title = "Nuevo pedido #" + id;
				body = order.customerName() + " hizo un pedido por " + clp(order.total())
						+ ". Confírmalo para pasarlo a en proceso.";
			}
			case ACEPTADO -> {
				title = "Tu pedido #" + id + " está en proceso";
				body = "Confirmamos tu pedido y la cocina ya lo recibió.";
			}
			case EN_PREPARACION -> {
				title = "Estamos preparando tu pedido #" + id;
				body = "Tu pedido ya se está preparando.";
			}
			case DESPACHADO -> {
				title = "Tu pedido #" + id + " va en camino";
				body = "Lo despachamos a " + (order.deliveryAddress() != null ? order.deliveryAddress() : "tu dirección") + ".";
			}
			case ENTREGADO -> {
				title = "Tu pedido #" + id + " fue entregado";
				body = "Gracias por tu compra. Te enviamos la boleta electrónica a tu correo.";
			}
			case CANCELADO -> {
				title = "Tu pedido #" + id + " fue cancelado";
				body = "Si no lo cancelaste tú, contáctanos.";
			}
			default -> {
				return null;
			}
		}
		Map<String, Object> payload = new LinkedHashMap<>();
		payload.put("audience", audience);
		payload.put("recipient", "ADMIN".equals(audience) ? null : order.customerEmail());
		payload.put("orderId", id);
		payload.put("status", event.status());
		payload.put("previousStatus", event.previousStatus());
		payload.put("title", title);
		payload.put("body", body);
		return payload;
	}

	private static String clp(java.math.BigDecimal amount) {
		java.text.DecimalFormatSymbols symbols = new java.text.DecimalFormatSymbols();
		symbols.setGroupingSeparator('.');
		java.text.DecimalFormat format = new java.text.DecimalFormat("#,##0", symbols);
		return "$" + format.format(amount == null ? 0 : amount.setScale(0, java.math.RoundingMode.HALF_UP));
	}

	private Map<String, Object> emailPayload(OrderEvent event) {
		OrderResponse order = event.order();
		Map<String, Object> payload = new LinkedHashMap<>();
		payload.put("orderId", order.id());
		payload.put("to", order.customerEmail());
		payload.put("customerName", order.customerName());
		payload.put("previousStatus", event.previousStatus());
		payload.put("status", order.status());
		payload.put("total", order.total());
		payload.put("channels", new String[] { "email", "webpush" });
		return payload;
	}

	/**
	 * Publica el comando directo en cmd.dead.dlx con la routing key de su flujo, asi RabbitMQ lo deja en la DLQ
	 * (por ejemplo email.send -> q.cmd.email.dlq) sin pasar por la cola de trabajo. Los headers dicen por que y
	 * a que cola iba; queda registrado en el log con [DLQ].
	 */
	private void sendToDeadLetter(String originalQueue, String routingKey, Command command, String reason) {
		log.error("[DLQ] {} del pedido {} no se envia a {}: {} -> {}.dlq (eventId={})", command.type(),
				command.payload().get("orderId"), originalQueue, reason, originalQueue, command.eventId());
		Map<String, Object> headers = new LinkedHashMap<>();
		headers.put("x-error-reason", reason);
		headers.put("x-original-queue", originalQueue);
		headers.put("x-original-routing-key", routingKey);
		headers.put("x-rejected-by", "ms-pedidos360-orders");
		send(MessagingConfig.CMD_DLX, routingKey, command, headers);
	}

	private void send(String exchange, String routingKey, Command command) {
		send(exchange, routingKey, command, Map.of());
	}

	private void send(String exchange, String routingKey, Command command, Map<String, Object> headers) {
		try {
			rabbitTemplate.convertAndSend(exchange, routingKey, command, message -> {
				message.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
				message.getMessageProperties().setMessageId(command.eventId());
				message.getMessageProperties().setType(command.type());
				message.getMessageProperties().setCorrelationId(command.correlationId());
				message.getMessageProperties().setHeader("traceId", command.traceId());
				headers.forEach(message.getMessageProperties()::setHeader);
				return message;
			});
			log.info("RabbitMQ {} -> {} [{}] pedido {}", command.type(), exchange, routingKey, command.payload().get("orderId"));
		} catch (RuntimeException ex) {
			log.error("No se pudo enviar {} a {} [{}]: {}", command.type(), exchange, routingKey, ex.getMessage());
			// Queda registrado en P360_UNSENT_MESSAGES y se reintenta cada 30 s
			unsentMessages.recordFailure(exchange, routingKey, command, ex);
		}
	}
}
