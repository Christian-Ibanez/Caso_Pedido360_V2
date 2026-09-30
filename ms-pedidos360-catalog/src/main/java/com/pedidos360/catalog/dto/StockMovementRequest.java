package com.pedidos360.catalog.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.List;

/**
 * Movimiento de stock de un pedido completo (lo llama ms-pedidos360-orders al aceptar o cancelar).
 * Es todo o nada: si falta stock de un producto no se descuenta ninguno.
 */
public record StockMovementRequest(
		Long orderId,
		@NotEmpty @Valid List<Item> items
) {
	public record Item(@NotNull Long productId, @NotNull @Positive Integer quantity) {
	}
}
