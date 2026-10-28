package com.pedidos360.mqadmin.controller;

import com.pedidos360.mqadmin.dto.ExchangeRequest;
import com.pedidos360.mqadmin.dto.ExchangeResponse;
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
@RequestMapping("/api/mq/exchanges")
@Tag(name = "Exchanges", description = "Crear, consultar y eliminar exchanges de RabbitMQ")
public class ExchangeController {

	private final RabbitAdminService service;

	public ExchangeController(RabbitAdminService service) {
		this.service = service;
	}

	@GetMapping
	@Operation(summary = "Listar exchanges")
	public List<ExchangeResponse> list() {
		return service.listExchanges();
	}

	@GetMapping("/{name}")
	@Operation(summary = "Consultar un exchange")
	public ExchangeResponse get(@PathVariable @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "nombre de exchange invalido") String name) {
		return service.getExchange(name);
	}

	@PostMapping
	@Operation(summary = "Crear un exchange direct, topic, fanout o headers")
	public ResponseEntity<ExchangeResponse> create(@Valid @RequestBody ExchangeRequest request) {
		ExchangeResponse created = service.createExchange(request);
		return ResponseEntity.created(ServletUriComponentsBuilder.fromCurrentRequest()
				.path("/{name}").buildAndExpand(created.name()).toUri()).body(created);
	}

	@DeleteMapping("/{name}")
	@Operation(summary = "Eliminar un exchange (los del sistema estan protegidos)")
	public ResponseEntity<Void> delete(
			@PathVariable @Pattern(regexp = ResourceNames.NAME_REGEX, message = "nombre de exchange invalido") String name) {
		service.deleteExchange(name);
		return ResponseEntity.noContent().build();
	}
}
