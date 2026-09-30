package com.pedidos360.report.dto;

import java.math.BigDecimal;

/** productId referencia a ms-pedidos360-catalog (el front cruza el nombre con /api/catalog/products). */
public record TopProductResponse(Long productId, long quantity, BigDecimal sales, long orders) {
}
