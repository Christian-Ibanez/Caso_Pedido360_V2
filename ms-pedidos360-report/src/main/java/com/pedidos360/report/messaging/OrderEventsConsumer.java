package com.pedidos360.report.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pedidos360.report.service.OrderFactProjector;
import lombok.RequiredArgsConstructor;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** Consume orders.events con su propio grupo (independiente de auditoria) y actualiza los KPIs. */
@Component
@RequiredArgsConstructor
public class OrderEventsConsumer {

	private final ObjectMapper objectMapper;
	private final OrderFactProjector projector;

	@KafkaListener(topics = "${app.kafka.topics.orders-events}", groupId = "${spring.kafka.consumer.group-id}")
	public void onOrderEvent(ConsumerRecord<String, String> record) throws Exception {
		OrderEventMessage event = objectMapper.readValue(record.value(), OrderEventMessage.class);
		if (event.eventId() == null || event.type() == null || event.timestamp() == null || event.orderId() == null) {
			throw new IllegalArgumentException("Evento incompleto en " + record.topic() + "-" + record.partition()
					+ "@" + record.offset());
		}
		projector.apply(event);
	}
}
