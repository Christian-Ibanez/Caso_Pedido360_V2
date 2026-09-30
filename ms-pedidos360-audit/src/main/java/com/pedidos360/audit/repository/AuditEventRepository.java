package com.pedidos360.audit.repository;

import com.pedidos360.audit.model.AuditEvent;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public interface AuditEventRepository extends JpaRepository<AuditEvent, Long>, JpaSpecificationExecutor<AuditEvent> {

	boolean existsByEventId(String eventId);

	List<AuditEvent> findByEntityTypeAndEntityIdOrderByOccurredAtAscIdAsc(String entityType, String entityId);

	@Query("select distinct e.eventType from AuditEvent e order by e.eventType")
	List<String> findDistinctEventTypes();

	@Query("select distinct e.actor from AuditEvent e where e.actor is not null order by e.actor")
	List<String> findDistinctActors();

	/** Filtros del caso: usuario, rango de fechas y tipo de evento (+ pedido). */
	static Specification<AuditEvent> filter(String actor, String eventType, String entityId, Instant from, Instant to) {
		return (root, query, cb) -> {
			List<Predicate> predicates = new ArrayList<>();
			if (actor != null && !actor.isBlank()) {
				predicates.add(cb.like(cb.lower(root.get("actor")), "%" + actor.trim().toLowerCase() + "%"));
			}
			if (eventType != null && !eventType.isBlank()) {
				predicates.add(cb.equal(root.get("eventType"), eventType.trim()));
			}
			if (entityId != null && !entityId.isBlank()) {
				predicates.add(cb.equal(root.get("entityId"), entityId.trim()));
			}
			if (from != null) {
				predicates.add(cb.greaterThanOrEqualTo(root.get("occurredAt"), from));
			}
			if (to != null) {
				predicates.add(cb.lessThanOrEqualTo(root.get("occurredAt"), to));
			}
			return cb.and(predicates.toArray(Predicate[]::new));
		};
	}
}
