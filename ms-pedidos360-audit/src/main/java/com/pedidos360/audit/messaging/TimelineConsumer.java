package com.pedidos360.audit.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pedidos360.audit.service.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Lee audit.timeline para registrar los pedidos creados con un correo rechazado (OrderEmailRejected).
 * ms-orders los publica directo en este topico, sin pasar por orders.events, para que reportes no los cuente.
 * Los registros que publica el propio ms-audit en el topico (formato AuditEventResponse) se ignoran.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TimelineConsumer {

	static final String EMAIL_REJECTED = "OrderEmailRejected";

	private final ObjectMapper objectMapper;
	private final AuditService auditService;

	@KafkaListener(topics = "${app.kafka.topics.timeline}", groupId = "${spring.kafka.consumer.group-id}")
	public void onTimeline(ConsumerRecord<String, String> record) throws Exception {
		JsonNode node = objectMapper.readTree(record.value());
		if (!EMAIL_REJECTED.equals(node.path("type").asText(null))) {
			return; // registro de auditoria ya guardado (lo publico este mismo micro)
		}
		OrderEventMessage event = objectMapper.treeToValue(node, OrderEventMessage.class);
		if (event.eventId() == null || event.timestamp() == null) {
			throw new IllegalArgumentException("Evento sin eventId/timestamp en " + record.topic() + "-"
					+ record.partition() + "@" + record.offset());
		}
		auditService.record(event, record.value(), record.topic(), record.partition(), record.offset(), false);
	}
}
