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
		timelinePublisher.publish(saved);
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
			case "OrderCreated" -> "creo el pedido";
			case "OrderUpdated" -> "edito el pedido";
			case "OrderDeleted" -> "elimino el pedido";
			case "OrderAccepted" -> "acepto el pedido";
			case "OrderPreparing" -> "paso a preparacion el pedido";
			case "OrderDispatched" -> "despacho el pedido";
			case "OrderDelivered" -> "marco como entregado el pedido";
			case "OrderCancelled" -> "cancelo el pedido";
			default -> "registro " + e.type() + " en el pedido";
		};
		String transition = e.previousStatus() != null && !e.previousStatus().equals(e.status())
				? " (" + e.previousStatus() + " -> " + e.status() + ")" : "";
		return who + " " + what + " #" + e.orderId() + transition + (e.origin() != null ? " desde " + e.origin() : "");
	}
}
