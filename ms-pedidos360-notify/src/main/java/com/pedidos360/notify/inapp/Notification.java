package com.pedidos360.notify.inapp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Notificacion de la campana del frontend. Llega como comando InAppNotify por RabbitMQ (q.notify.inapp).
 * audience ADMIN: la ven administradores y operadores. audience CUSTOMER: solo el cliente con ese correo.
 */
@Entity
@Table(name = "P360_NOTIFICATIONS", indexes = {
		@Index(name = "IX_P360_NOTIF_AUD", columnList = "audience, recipient")
})
@Getter
@Setter
@NoArgsConstructor
public class Notification {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/** eventId del comando: si RabbitMQ lo reentrega no se duplica. */
	@Column(nullable = false, unique = true, length = 64)
	private String eventId;

	@Column(nullable = false, length = 16)
	private String audience;

	/** Correo del cliente (en minusculas); vacio para ADMIN. */
	@Column(length = 160)
	private String recipient;

	private Long orderId;

	@Column(length = 32)
	private String status;

	@Column(nullable = false, length = 160)
	private String title;

	@Column(length = 500)
	private String body;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	private Instant readAt;

	@PrePersist
	void onCreate() {
		if (createdAt == null) {
			createdAt = Instant.now();
		}
	}
}
