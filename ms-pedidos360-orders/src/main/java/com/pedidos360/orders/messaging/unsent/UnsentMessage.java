package com.pedidos360.orders.messaging.unsent;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Comando que no se pudo publicar en RabbitMQ (broker caido o mensaje sin cola de destino).
 * Las filas no se borran: quedan como registro aunque despues se envien.
 */
@Entity
@Table(name = "P360_UNSENT_MESSAGES")
@Getter
@Setter
@NoArgsConstructor
public class UnsentMessage {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, length = 60)
	private String eventId;

	@Column(nullable = false, length = 60)
	private String messageType;

	@Column(nullable = false, length = 60)
	private String exchangeName;

	@Column(nullable = false, length = 60)
	private String routingKey;

	@Column(length = 80)
	private String correlationId;

	@Column(length = 80)
	private String traceId;

	@Lob
	@Column(nullable = false)
	private String body;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private UnsentStatus status;

	@Column(length = 500)
	private String lastError;

	@Column(nullable = false)
	private int attempts;

	@Column(nullable = false)
	private LocalDateTime createdAt;

	private LocalDateTime lastAttemptAt;

	private LocalDateTime sentAt;
}
