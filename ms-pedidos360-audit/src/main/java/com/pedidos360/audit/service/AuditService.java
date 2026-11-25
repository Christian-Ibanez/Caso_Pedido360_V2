package com.pedidos360.audit.service;

import com.pedidos360.audit.dto.AuditEventDetail;
import com.pedidos360.audit.dto.AuditEventResponse;
import com.pedidos360.audit.exception.AuditEventNotFoundException;
import com.pedidos360.audit.messaging.OrderEventMessage;
import com.pedidos360.audit.messaging.TimelinePublisher;
import com.pedidos360.audit.model.AuditEvent;
import com.pedidos360.audit.repository.AuditEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

	public static final String ENTITY_ORDER = "ORDER";

	private final AuditEventRepository repository;
	private final TimelinePublisher timelinePublisher;

	/** Idempotente: si el eventId ya fue registrado (reentrega de Kafka) no se duplica. */
	@Transactional
	public boolean record(OrderEventMessage event, String rawJson, String topic, int partition, long offset) {
		return record(event, rawJson, topic, partition, offset, true);
	}

	/**
	 * @param publishTimeline false cuando el evento ya viene de audit.timeline (OrderEmailRejected que publica
	 *                        ms-orders): se registra pero no se vuelve a publicar en el mismo topico.
	 */
	@Transactional
	public boolean record(OrderEventMessage event, String rawJson, String topic, int partition, long offset,
			boolean publishTimeline) {
		if (repository.existsByEventId(event.eventId())) {
			log.info("Evento {} ya auditado, se omite", event.eventId());
			return false;
		}
		AuditEvent audit = new AuditEvent();
		audit.setEventId(event.eventId());
		audit.setEventType(event.type());
		audit.setEntityType(ENTITY_ORDER);
		audit.setEntityId(event.orderId() != null ? event.orderId().toString() : null);
		audit.setActor(event.actor());
		audit.setOrigin(event.origin());
		audit.setPreviousStatus(event.previousStatus());
		audit.setNewStatus(event.status());
		audit.setSummary(summary(event));
		audit.setOccurredAt(event.timestamp());
		audit.setSourceService(event.source());
		audit.setTraceId(event.traceId());
		audit.setCorrelationId(event.correlationId());
		audit.setKafkaTopic(topic);
		audit.setKafkaPartition(partition);
		audit.setKafkaOffset(offset);
		audit.setPayload(rawJson);
		AuditEventResponse saved = AuditEventResponse.from(repository.save(audit));
		if (publishTimeline) {
			timelinePublisher.publish(saved);
		}
		log.info("Auditado {} pedido {} por {} desde {}", event.type(), event.orderId(), event.actor(), event.origin());
		return true;
	}

	@Transactional(readOnly = true)
	public List<AuditEventResponse> search(String actor, String eventType, String orderId, Instant from, Instant to, int limit) {
		int size = Math.max(1, Math.min(limit, 1000));
		return repository.findAll(AuditEventRepository.filter(actor, eventType, orderId, from, to),
						PageRequest.of(0, size, Sort.by(Sort.Direction.DESC, "occurredAt", "id")))
				.stream().map(AuditEventResponse::from).toList();
	}

	@Transactional(readOnly = true)
	public AuditEventDetail findById(Long id) {
		return repository.findById(id).map(AuditEventDetail::from).orElseThrow(() -> new AuditEventNotFoundException(id));
	}

	@Transactional(readOnly = true)
	public List<AuditEventResponse> orderTimeline(Long orderId) {
		return repository.findByEntityTypeAndEntityIdOrderByOccurredAtAscIdAsc(ENTITY_ORDER, orderId.toString())
				.stream().map(AuditEventResponse::from).toList();
	}

	@Transactional(readOnly = true)
	public List<String> eventTypes() {
		return repository.findDistinctEventTypes();
	}

	@Transactional(readOnly = true)
	public List<String> actors() {
		return repository.findDistinctActors();
	}

	private static String summary(OrderEventMessage e) {
		String who = e.actor() != null ? e.actor() : "desconocido";
		String what = switch (e.type()) {
			case "OrderCreated" -> "creó el pedido";
			case "OrderUpdated" -> "editó el pedido";
			case "OrderDeleted" -> "eliminó el pedido";
			case "OrderAccepted" -> "aceptó el pedido";
			case "OrderPreparing" -> "pasó a preparación el pedido";
			case "OrderDispatched" -> "despachó el pedido";
			case "OrderDelivered" -> "marcó como entregado el pedido";
			case "OrderCancelled" -> "canceló el pedido";
			case "OrderPaid" -> "pagó el pedido";
			case "OrderEmailRejected" -> "creó el pedido";
			default -> "registró " + e.type() + " en el pedido";
		};
		String payment = "OrderPaid".equals(e.type()) && e.order() != null && e.order().paymentMethod() != null
				? " con " + paymentLabel(e.order().paymentMethod())
				: "OrderEmailRejected".equals(e.type()) && e.order() != null && e.order().customerEmail() != null
						? " con un correo rechazado (" + e.order().customerEmail() + ")" : "";
		String transition = e.previousStatus() != null && !e.previousStatus().equals(e.status())
				? " (" + e.previousStatus() + " -> " + e.status() + ")" : "";
		return who + " " + what + " #" + e.orderId() + payment + transition + (e.origin() != null ? " desde " + e.origin() : "");
	}

	private static String paymentLabel(String method) {
		return switch (method) {
			case "TARJETA_CREDITO" -> "tarjeta de crédito";
			case "TARJETA_DEBITO" -> "tarjeta de débito";
			case "TRANSFERENCIA" -> "transferencia";
			case "EFECTIVO" -> "efectivo";
			default -> method.toLowerCase();
		};
	}
}
