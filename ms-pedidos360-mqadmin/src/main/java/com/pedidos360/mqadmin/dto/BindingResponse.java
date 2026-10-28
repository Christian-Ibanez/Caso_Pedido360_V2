package com.pedidos360.mqadmin.dto;

public record BindingResponse(String exchange, String queue, String routingKey, boolean system) {
}
