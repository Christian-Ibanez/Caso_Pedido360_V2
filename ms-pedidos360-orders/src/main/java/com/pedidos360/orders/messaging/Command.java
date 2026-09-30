package com.pedidos360.orders.messaging;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Comando enviado por RabbitMQ a ms-pedidos360-notify. Mismo envelope que los eventos;
 * eventId sirve para que el consumidor sea idempotente.
 */
public record Command(
		String type,
		String eventId,
		Instant timestamp,
		String traceId,
		String correlationId,
		Map<String, Object> payload
) {
	public static Command of(String type, OrderEvent event, Map<String, Object> payload) {
		return new Command(type, UUID.randomUUID().toString(), Instant.now(), event.traceId(), event.correlationId(), payload);
	}
}
