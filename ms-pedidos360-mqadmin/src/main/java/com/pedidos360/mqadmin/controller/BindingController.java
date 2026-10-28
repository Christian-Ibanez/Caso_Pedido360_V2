package com.pedidos360.mqadmin.controller;

import com.pedidos360.mqadmin.dto.BindingRequest;
import com.pedidos360.mqadmin.dto.BindingResponse;
import com.pedidos360.mqadmin.dto.ResourceNames;
import com.pedidos360.mqadmin.service.RabbitAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Un binding se identifica por exchange + cola + routing key, por eso se elimina con query params. */
@RestController
@RequestMapping("/api/mq/bindings")
@Tag(name = "Bindings", description = "Enlazar exchanges con colas")
public class BindingController {

	private final RabbitAdminService service;

	public BindingController(RabbitAdminService service) {
		this.service = service;
	}

	@GetMapping
	@Operation(summary = "Listar bindings exchange -> cola (filtros opcionales por exchange y cola)")
	public List<BindingResponse> list(@RequestParam(required = false) String exchange,
			@RequestParam(required = false) String queue) {
		return service.listBindings(exchange, queue);
	}

	@PostMapping
	@Operation(summary = "Crear un binding")
	public ResponseEntity<BindingResponse> create(@Valid @RequestBody BindingRequest request) {
		return ResponseEntity.status(HttpStatus.CREATED).body(service.createBinding(request));
	}

	@DeleteMapping
	@Operation(summary = "Eliminar un binding (DELETE /api/mq/bindings?exchange=..&queue=..&routingKey=..)")
	public ResponseEntity<Void> delete(
			@RequestParam @NotBlank(message = "exchange es obligatorio")
			@Pattern(regexp = ResourceNames.NAME_REGEX, message = "nombre de exchange invalido") String exchange,
			@RequestParam @NotBlank(message = "queue es obligatorio")
			@Pattern(regexp = ResourceNames.NAME_REGEX, message = "nombre de cola invalido") String queue,
			@RequestParam(defaultValue = "")
			@Pattern(regexp = ResourceNames.ROUTING_KEY_REGEX, message = ResourceNames.ROUTING_KEY_MESSAGE) String routingKey) {
		service.deleteBinding(exchange, queue, routingKey);
		return ResponseEntity.noContent().build();
	}
}
