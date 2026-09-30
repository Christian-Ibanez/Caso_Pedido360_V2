package com.pedidos360.notify.consumer;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.Instant;
import java.util.Map;

/** Envelope comun de los comandos (lo produce ms-pedidos360-orders). */
@JsonIgnoreProperties(ignoreUnknown = true)
public record CommandEnvelope(
		String type,
		String eventId,
		Instant timestamp,
		String traceId,
		String correlationId,
		Map<String, Object> payload
) {
}
