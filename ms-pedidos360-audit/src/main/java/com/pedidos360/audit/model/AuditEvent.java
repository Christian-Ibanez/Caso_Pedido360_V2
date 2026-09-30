package com.pedidos360.audit.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Registro de auditoria: quien / que / cuando / desde donde, sobre que entidad. Solo se inserta, nunca se edita. */
@Entity
@Table(name = "P360_AUDIT_EVENTS", indexes = {
		@Index(name = "IX_AUDIT_ENTITY", columnList = "entityType,entityId"),
		@Index(name = "IX_AUDIT_OCCURRED", columnList = "occurredAt"),
		@Index(name = "IX_AUDIT_ACTOR", columnList = "actor")
})
@Getter
@Setter
@NoArgsConstructor
public class AuditEvent {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/** eventId del productor: unico, asi un evento reentregado por Kafka no se duplica. */
	@Column(nullable = false, unique = true, length = 64, updatable = false)
	private String eventId;

	@Column(nullable = false, length = 60, updatable = false)
	private String eventType;

	@Column(nullable = false, length = 30, updatable = false)
	private String entityType;

	@Column(length = 60, updatable = false)
	private String entityId;

	/** Quien. */
	@Column(length = 150, updatable = false)
	private String actor;

	/** Desde donde (IP de origen). */
	@Column(length = 64, updatable = false)
	private String origin;

	@Column(length = 30, updatable = false)
	private String previousStatus;

	@Column(length = 30, updatable = false)
	private String newStatus;

	/** Que, en texto legible. */
	@Column(length = 400, updatable = false)
	private String summary;

	/** Cuando ocurrio (segun el productor). */
	@Column(nullable = false, updatable = false)
	private Instant occurredAt;

	@Column(nullable = false, updatable = false)
	private Instant recordedAt;

	@Column(length = 80, updatable = false)
	private String sourceService;

	@Column(length = 64, updatable = false)
	private String traceId;

	@Column(length = 64, updatable = false)
	private String correlationId;

	@Column(length = 120, updatable = false)
	private String kafkaTopic;

	private Integer kafkaPartition;
	private Long kafkaOffset;

	/** Evento original completo (JSON). */
	@Lob
	@Column(updatable = false)
	private String payload;

	@PrePersist
	void onCreate() {
		recordedAt = Instant.now();
	}
}
