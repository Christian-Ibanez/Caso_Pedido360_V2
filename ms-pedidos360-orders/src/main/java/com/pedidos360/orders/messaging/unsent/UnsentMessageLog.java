package com.pedidos360.orders.messaging.unsent;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pedidos360.orders.messaging.Command;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Registro de comandos que no llegaron a RabbitMQ. Si el broker esta caido el comando se guarda en
 * P360_UNSENT_MESSAGES y cada 30 s se intenta de nuevo; al lograrlo la fila pasa a ENVIADO (no se borra).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UnsentMessageLog {

	private final UnsentMessageRepository repository;
	private final ObjectMapper objectMapper;
	private final RabbitTemplate rabbitTemplate;

	@Value("${app.messaging.enabled:false}")
	private boolean enabled;

	/** No se pudo publicar (excepcion al enviar). */
	public void recordFailure(String exchange, String routingKey, Command command, Exception error) {
		try {
			save(command.eventId(), command.type(), exchange, routingKey, command.correlationId(), command.traceId(),
					objectMapper.writeValueAsString(command), UnsentStatus.PENDIENTE, describe(error));
			log.warn("[NO ENVIADO] {} -> {} [{}] guardado para reintento (eventId={}): {}",
					command.type(), exchange, routingKey, command.eventId(), describe(error));
		} catch (JsonProcessingException | RuntimeException ex) {
			log.error("No se pudo registrar el comando no enviado {} (eventId={})", command.type(), command.eventId(), ex);
		}
	}

	/** RabbitMQ devolvio el mensaje porque ninguna cola lo acepta. */
	public void recordReturned(Message message, String exchange, String routingKey, String reason) {
		MessageProperties props = message.getMessageProperties();
		String eventId = props.getMessageId() != null ? props.getMessageId() : java.util.UUID.randomUUID().toString();
		try {
			save(eventId, props.getType() != null ? props.getType() : "Desconocido", exchange, routingKey,
					props.getCorrelationId(), (String) props.getHeader("traceId"),
					new String(message.getBody(), StandardCharsets.UTF_8), UnsentStatus.SIN_RUTA, reason);
		} catch (RuntimeException ex) {
			log.error("No se pudo registrar el mensaje devuelto (eventId={})", eventId, ex);
		}
	}

	@Scheduled(fixedDelayString = "${app.messaging.retry-ms:30000}", initialDelayString = "${app.messaging.retry-ms:30000}")
	public void retryPending() {
		if (!enabled) {
			return;
		}
		List<UnsentMessage> pending = repository.findTop50ByStatusOrderByIdAsc(UnsentStatus.PENDIENTE);
		for (UnsentMessage m : pending) {
			m.setAttempts(m.getAttempts() + 1);
			m.setLastAttemptAt(LocalDateTime.now());
			try {
				rabbitTemplate.send(m.getExchangeName(), m.getRoutingKey(), toMessage(m));
				m.setStatus(UnsentStatus.ENVIADO);
				m.setSentAt(LocalDateTime.now());
				repository.save(m);
				log.info("[REENVIADO] {} -> {} [{}] en el intento {} (eventId={})",
						m.getMessageType(), m.getExchangeName(), m.getRoutingKey(), m.getAttempts(), m.getEventId());
			} catch (RuntimeException ex) {
				m.setLastError(describe(ex));
				repository.save(m);
				log.warn("RabbitMQ sigue sin responder, {} comandos pendientes: {}", pending.size(), describe(ex));
				return;
			}
		}
	}

	private void save(String eventId, String type, String exchange, String routingKey, String correlationId,
			String traceId, String body, UnsentStatus status, String error) {
		UnsentMessage m = repository.findByEventId(eventId).orElseGet(UnsentMessage::new);
		if (m.getId() == null) {
			m.setEventId(eventId);
			m.setMessageType(type);
			m.setExchangeName(exchange);
			m.setRoutingKey(routingKey);
			m.setCorrelationId(correlationId);
			m.setTraceId(traceId);
			m.setBody(body);
			m.setCreatedAt(LocalDateTime.now());
		}
		m.setStatus(status);
		m.setLastError(error);
		repository.save(m);
	}

	private static Message toMessage(UnsentMessage m) {
		return MessageBuilder.withBody(m.getBody().getBytes(StandardCharsets.UTF_8))
				.setContentType(MessageProperties.CONTENT_TYPE_JSON)
				.setContentEncoding(StandardCharsets.UTF_8.name())
				.setDeliveryMode(MessageDeliveryMode.PERSISTENT)
				.setMessageId(m.getEventId())
				.setType(m.getMessageType())
				.setCorrelationId(m.getCorrelationId())
				.setHeader("traceId", m.getTraceId())
				.setHeader("retried", true)
				.build();
	}

	private static String describe(Throwable error) {
		Throwable root = error;
		while (root.getCause() != null && root.getCause() != root) {
			root = root.getCause();
		}
		String text = error.getClass().getSimpleName() + ": " + (root.getMessage() != null ? root.getMessage() : error.getMessage());
		return text.length() > 500 ? text.substring(0, 500) : text;
	}
}
