package com.pedidos360.notify.inapp;

import java.time.Instant;

public record NotificationResponse(
		Long id,
		String audience,
		Long orderId,
		String status,
		String title,
		String body,
		Instant createdAt,
		boolean read
) {
	public static NotificationResponse from(Notification n) {
		return new NotificationResponse(n.getId(), n.getAudience(), n.getOrderId(), n.getStatus(), n.getTitle(),
				n.getBody(), n.getCreatedAt(), n.getReadAt() != null);
	}
}
