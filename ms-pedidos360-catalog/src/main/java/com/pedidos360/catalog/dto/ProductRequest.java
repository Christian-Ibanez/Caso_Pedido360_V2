package com.pedidos360.catalog.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;

/** Alta de producto (POST). */
public record ProductRequest(
		@NotBlank @Size(max = 40) String sku,
		@NotBlank @Size(max = 120) String name,
		@Size(max = 500) String description,
		@Size(max = 60) String category,
		@NotNull @PositiveOrZero BigDecimal price,
		@NotNull @PositiveOrZero Integer stock,
		Boolean active
) {
}
