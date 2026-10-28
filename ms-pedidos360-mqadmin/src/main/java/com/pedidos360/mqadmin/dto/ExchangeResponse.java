package com.pedidos360.mqadmin.dto;

public record ExchangeResponse(String name, String type, boolean durable, boolean autoDelete, boolean internal,
		boolean system) {
}
