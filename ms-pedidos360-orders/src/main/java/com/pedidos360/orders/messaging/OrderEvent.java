package com.pedidos360.orders.messaging;

import com.pedidos360.orders.dto.OrderResponse;
import com.pedidos360.orders.model.OrderStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * Evento de negocio publicado en Kafka (topico orders.events, key = orderId).
 * Envelope comun (type, eventId, timestamp, traceId, correlationId) + quien/desde donde + foto del pedido.
 * Reporteria y auditoria lo consumen; como trae la foto completa, reprocesarlo es idempotente.
 */
public record OrderEvent(
		String type,
		String eventId,
		Instant timestamp,
		String traceId,
		String correlationId,
		String source,
		String actor,
		String origin,
		Long orderId,
		OrderStatus previousStatus,
		OrderStatus status,
		OrderResponse order
) {
	public static final String CREATED = "OrderCreated";
	public static final String UPDATED = "OrderUpdated";
	public static final String DELETED = "OrderDeleted";
	/** El cliente pago el pedido (no cambia el estado): genera la boleta en q.cmd.invoice. */
	public static final String PAID = "OrderPaid";
	/** Pedido creado con un correo invalido (@fail.test, sin formato): va a audit.timeline en vez de orders.events. */
	public static final String EMAIL_REJECTED = "OrderEmailRejected";
	/** El sistema rechazo el pedido porque el cliente no pago a tiempo (estado RECHAZADO). */
	public static final String REJECTED = "OrderRejected";

	public OrderEvent withType(String newType) {
		return new OrderEvent(newType, eventId, timestamp, traceId, correlationId, source, actor, origin, orderId,
				previousStatus, status, order);
	}

	public static OrderEvent of(String type, OrderStatus previousStatus, OrderResponse order, RequestMetadata meta) {
		return new OrderEvent(type, UUID.randomUUID().toString(), Instant.now(), meta.traceId(), meta.correlationId(),
				"ms-pedidos360-orders", meta.actor(), meta.origin(), order.id(), previousStatus, order.status(), order);
	}

	/** OrderAccepted, OrderPreparing, OrderDispatched, OrderDelivered, OrderCancelled. */
	public static String typeFor(OrderStatus status) {
		return switch (status) {
			case CREADO -> CREATED;
			case ACEPTADO -> "OrderAccepted";
			case EN_PREPARACION -> "OrderPreparing";
			case DESPACHADO -> "OrderDispatched";
			case ENTREGADO -> "OrderDelivered";
			case CANCELADO -> "OrderCancelled";
			case RECHAZADO -> REJECTED;
		};
	}
}
