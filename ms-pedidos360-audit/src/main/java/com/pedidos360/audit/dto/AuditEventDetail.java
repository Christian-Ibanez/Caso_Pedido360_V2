package com.pedidos360.audit.dto;

import com.pedidos360.audit.model.AuditEvent;

/** Detalle: el registro + el evento original tal como llego de Kafka. */
public record AuditEventDetail(AuditEventResponse event, String payload, String kafkaTopic, Integer kafkaPartition,
		Long kafkaOffset) {

	public static AuditEventDetail from(AuditEvent e) {
		return new AuditEventDetail(AuditEventResponse.from(e), e.getPayload(), e.getKafkaTopic(), e.getKafkaPartition(),
				e.getKafkaOffset());
	}
}
