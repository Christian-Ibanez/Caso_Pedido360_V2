package com.pedidos360.catalog.dto;

import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/** Edicion parcial (PUT /{id}): solo se cambian los campos que vienen. Uso tipico: precio y/o stock. */
public record ProductUpdateRequest(
		@Size(max = 120) String name,
		@Size(max = 500) String description,
		@Size(max = 60) String category,
		@PositiveOrZero BigDecimal price,
		@PositiveOrZero Integer stock,
		Boolean active
) {
}
