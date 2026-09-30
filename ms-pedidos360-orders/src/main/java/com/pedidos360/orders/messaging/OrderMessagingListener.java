package com.pedidos360.orders.messaging;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pedidos360.orders.dto.OrderResponse;
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

/**
 * Publica despues del commit y en otro hilo: si Kafka o RabbitMQ estan caidos el pedido igual queda guardado
 * y la API responde (el core no se bloquea). Con app.messaging.enabled=false (perfil local/tests) no publica nada.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrderMessagingListener {

	private final KafkaTemplate<String, String> kafkaTemplate;
	private final RabbitTemplate rabbitTemplate;
	private final ObjectMapper objectMapper;

	@Value("${app.messaging.enabled:false}")
	private boolean enabled;

	@Async("messagingExecutor")
	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
	public void on(OrderEvent event) {
		if (!enabled) {
			log.debug("Mensajeria desactivada, no se publica {} del pedido {}", event.type(), event.orderId());
			return;
		}
		publishEvent(event);
		sendCommands(event);
	}

	private void publishEvent(OrderEvent event) {
		try {
			String json = objectMapper.writeValueAsString(event);
			kafkaTemplate.send(MessagingTopology.ORDERS_EVENTS_TOPIC, String.valueOf(event.orderId()), json)
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

		// Cancelaciones salen como prioritarias por el exchange topic (email.# -> q.cmd.email)
		if (event.status() == OrderStatus.CANCELADO) {
			send(MessagingTopology.CMD_TOPIC, MessagingTopology.RK_EMAIL_HIGH, Command.of("EmailSend", event, emailPayload(event)));
		} else {
			send(MessagingTopology.CMD_DIRECT, MessagingTopology.RK_EMAIL, Command.of("EmailSend", event, emailPayload(event)));
		}

		if (event.status() == OrderStatus.ACEPTADO) {
			Map<String, Object> ticket = new LinkedHashMap<>();
			ticket.put("orderId", order.id());
			ticket.put("storeId", order.storeId());
			ticket.put("customerName", order.customerName());
			ticket.put("notes", order.notes());
			ticket.put("items", order.items());
			send(MessagingTopology.CMD_DIRECT, MessagingTopology.RK_KITCHEN, Command.of("KitchenTicket", event, ticket));
		}

		if (event.status() == OrderStatus.ENTREGADO) {
			Map<String, Object> invoice = new LinkedHashMap<>();
			invoice.put("orderId", order.id());
			invoice.put("storeId", order.storeId());
			invoice.put("customerName", order.customerName());
			invoice.put("customerEmail", order.customerEmail());
			invoice.put("total", order.total());
			invoice.put("items", order.items());
			send(MessagingTopology.CMD_TOPIC, MessagingTopology.RK_INVOICE_PDF, Command.of("InvoiceGenerate", event, invoice));
		}
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

	private void send(String exchange, String routingKey, Command command) {
		try {
			rabbitTemplate.convertAndSend(exchange, routingKey, command, message -> {
				message.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
				message.getMessageProperties().setMessageId(command.eventId());
				message.getMessageProperties().setType(command.type());
				message.getMessageProperties().setCorrelationId(command.correlationId());
				message.getMessageProperties().setHeader("traceId", command.traceId());
				return message;
			});
			log.info("RabbitMQ {} -> {} [{}] pedido {}", command.type(), exchange, routingKey, command.payload().get("orderId"));
		} catch (RuntimeException ex) {
			log.error("No se pudo enviar {} a {} [{}]: {}", command.type(), exchange, routingKey, ex.getMessage());
		}
	}
}
