package com.pedidos360.catalog.dto;

import com.pedidos360.catalog.model.Product;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ProductResponse(
		Long id,
		String sku,
		String name,
		String description,
		String category,
		BigDecimal price,
		Integer stock,
		Boolean active,
		LocalDateTime createdAt,
		LocalDateTime updatedAt
) {
	public static ProductResponse from(Product p) {
		return new ProductResponse(p.getId(), p.getSku(), p.getName(), p.getDescription(), p.getCategory(),
				p.getPrice(), p.getStock(), p.getActive(), p.getCreatedAt(), p.getUpdatedAt());
	}
}
