package com.pedidos360.mqadmin.controller;

import com.pedidos360.mqadmin.dto.QueueRequest;
import com.pedidos360.mqadmin.dto.QueueResponse;
import com.pedidos360.mqadmin.dto.ResourceNames;
import com.pedidos360.mqadmin.service.RabbitAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.List;

@RestController
@RequestMapping("/api/mq/queues")
@Tag(name = "Colas", description = "Crear, consultar y eliminar colas de RabbitMQ")
public class QueueController {

	private final RabbitAdminService service;

	public QueueController(RabbitAdminService service) {
		this.service = service;
	}

	@GetMapping
	@Operation(summary = "Listar colas con sus contadores (Ready, Unacked, Total, consumidores)")
	public List<QueueResponse> list() {
		return service.listQueues();
	}

	@GetMapping("/{name}")
	@Operation(summary = "Consultar una cola")
	public QueueResponse get(@PathVariable @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "nombre de cola invalido") String name) {
		return service.getQueue(name);
	}

	@PostMapping
	@Operation(summary = "Crear una cola (durable por defecto; DLX, TTL y largo maximo opcionales)")
	public ResponseEntity<QueueResponse> create(@Valid @RequestBody QueueRequest request) {
		QueueResponse created = service.createQueue(request);
		return ResponseEntity.created(ServletUriComponentsBuilder.fromCurrentRequest()
				.path("/{name}").buildAndExpand(created.name()).toUri()).body(created);
	}

	@DeleteMapping("/{name}")
	@Operation(summary = "Eliminar una cola (con ifEmpty=true no se elimina si tiene mensajes)")
	public ResponseEntity<Void> delete(
			@PathVariable @Pattern(regexp = ResourceNames.NAME_REGEX, message = "nombre de cola invalido") String name,
			@RequestParam(defaultValue = "true") boolean ifEmpty) {
		service.deleteQueue(name, ifEmpty);
		return ResponseEntity.noContent().build();
	}
}
