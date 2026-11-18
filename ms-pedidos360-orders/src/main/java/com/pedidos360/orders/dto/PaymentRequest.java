package com.pedidos360.orders.dto;

import com.pedidos360.orders.model.PaymentMethod;
import jakarta.validation.constraints.NotNull;

public record PaymentRequest(@NotNull PaymentMethod method) {
}
