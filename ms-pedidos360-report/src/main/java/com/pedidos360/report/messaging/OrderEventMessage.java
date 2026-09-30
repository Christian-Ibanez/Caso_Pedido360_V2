package com.pedidos360.report.messaging;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

/** Evento de orders.events: envelope + foto del pedido (solo los campos que usa reporteria). */
@JsonIgnoreProperties(ignoreUnknown = true)
public record OrderEventMessage(
		String type,
		String eventId,
		Instant timestamp,
		Long orderId,
		String status,
		Order order
) {
	@JsonIgnoreProperties(ignoreUnknown = true)
	public record Order(
			Long id,
			Long storeId,
			String status,
			BigDecimal total,
			List<Item> items,
			LocalDateTime createdAt,
			LocalDateTime acceptedAt,
			LocalDateTime dispatchedAt,
			LocalDateTime deliveredAt,
			LocalDateTime updatedAt
	) {
	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	public record Item(Long productId, Integer quantity, BigDecimal unitPrice, BigDecimal subtotal) {
	}
}
