package com.pedidos360.audit.messaging;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.Instant;

/** Lo que auditoria necesita del evento de orders.events (el resto del JSON se guarda tal cual en payload). */
@JsonIgnoreProperties(ignoreUnknown = true)
public record OrderEventMessage(
		String type,
		String eventId,
		Instant timestamp,
		String traceId,
		String correlationId,
		String source,
		String actor,
		String origin,
		Long orderId,
		String previousStatus,
		String status,
		OrderSnapshot order
) {
	/** Del pedido solo interesa el medio de pago (para el resumen del evento OrderPaid). */
	@JsonIgnoreProperties(ignoreUnknown = true)
	public record OrderSnapshot(String paymentMethod) {
	}
}
