package com.pedidos360.mqadmin.dto;

import java.util.Map;

/** Cola con sus contadores (Ready, Unacked, Total) y si es parte de la topologia del sistema. */
public record QueueResponse(
		String name,
		boolean durable,
		boolean autoDelete,
		long messages,
		long messagesReady,
		long messagesUnacknowledged,
		int consumers,
		Map<String, Object> arguments,
		boolean system) {
}
