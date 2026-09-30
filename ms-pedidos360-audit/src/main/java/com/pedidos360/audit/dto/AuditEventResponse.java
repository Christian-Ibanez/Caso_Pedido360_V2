package com.pedidos360.audit.dto;

import com.pedidos360.audit.model.AuditEvent;

import java.time.Instant;

public record AuditEventResponse(
		Long id,
		String eventId,
		String eventType,
		String entityType,
		String entityId,
		String actor,
		String origin,
		String previousStatus,
		String newStatus,
		String summary,
		Instant occurredAt,
		Instant recordedAt,
		String sourceService,
		String traceId,
		String correlationId
) {
	public static AuditEventResponse from(AuditEvent e) {
		return new AuditEventResponse(e.getId(), e.getEventId(), e.getEventType(), e.getEntityType(), e.getEntityId(),
				e.getActor(), e.getOrigin(), e.getPreviousStatus(), e.getNewStatus(), e.getSummary(), e.getOccurredAt(),
				e.getRecordedAt(), e.getSourceService(), e.getTraceId(), e.getCorrelationId());
	}
}
