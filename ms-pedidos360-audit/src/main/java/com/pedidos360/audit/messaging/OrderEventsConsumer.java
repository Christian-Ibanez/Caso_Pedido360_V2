package com.pedidos360.audit.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pedidos360.audit.service.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** Consume orders.events (grupo propio) y persiste cada evento como registro de auditoria. */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrderEventsConsumer {

	private final ObjectMapper objectMapper;
	private final AuditService auditService;

	@KafkaListener(topics = "${app.kafka.topics.orders-events}", groupId = "${spring.kafka.consumer.group-id}")
	public void onOrderEvent(ConsumerRecord<String, String> record) throws Exception {
		OrderEventMessage event = objectMapper.readValue(record.value(), OrderEventMessage.class);
		if (event.eventId() == null || event.type() == null || event.timestamp() == null) {
			throw new IllegalArgumentException("Evento sin eventId/type/timestamp en " + record.topic() + "-"
					+ record.partition() + "@" + record.offset());
		}
		auditService.record(event, record.value(), record.topic(), record.partition(), record.offset());
	}
}
