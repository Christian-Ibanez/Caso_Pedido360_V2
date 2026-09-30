package com.pedidos360.audit.controller;

import com.pedidos360.audit.dto.AuditEventDetail;
import com.pedidos360.audit.dto.AuditEventResponse;
import com.pedidos360.audit.service.AuditService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

/** Solo lectura: los registros llegan exclusivamente desde Kafka. */
@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
@Tag(name = "Auditoria")
public class AuditController {

	private final AuditService service;

	@GetMapping("/events")
	@Operation(summary = "Timeline de eventos (mas reciente primero). Filtros: user, type, orderId, from/to (ISO: 2026-09-10T00:00:00Z)")
	public List<AuditEventResponse> search(
			@RequestParam(required = false) String user,
			@RequestParam(required = false) String type,
			@RequestParam(required = false) String orderId,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
			@RequestParam(defaultValue = "200") int limit) {
		return service.search(user, type, orderId, from, to, limit);
	}

	@GetMapping("/events/{id}")
	@Operation(summary = "Detalle de un evento, con el mensaje original de Kafka")
	public AuditEventDetail findById(@PathVariable Long id) {
		return service.findById(id);
	}

	@GetMapping("/orders/{orderId}/timeline")
	@Operation(summary = "Trazabilidad completa de un pedido (orden cronologico)")
	public List<AuditEventResponse> orderTimeline(@PathVariable Long orderId) {
		return service.orderTimeline(orderId);
	}

	@GetMapping("/event-types")
	@Operation(summary = "Tipos de evento registrados (para el filtro)")
	public List<String> eventTypes() {
		return service.eventTypes();
	}

	@GetMapping("/actors")
	@Operation(summary = "Usuarios que aparecen en la auditoria (para el filtro)")
	public List<String> actors() {
		return service.actors();
	}
}
