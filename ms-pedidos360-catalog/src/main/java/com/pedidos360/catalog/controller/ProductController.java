package com.pedidos360.catalog.controller;

import com.pedidos360.catalog.dto.ProductRequest;
import com.pedidos360.catalog.dto.ProductResponse;
import com.pedidos360.catalog.dto.ProductUpdateRequest;
import com.pedidos360.catalog.dto.StockMovementRequest;
import com.pedidos360.catalog.service.ProductService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/catalog/products")
@RequiredArgsConstructor
@Tag(name = "Catalogo")
public class ProductController {

	private final ProductService service;

	@GetMapping
	@Operation(summary = "Listar productos (filtros opcionales: q = nombre/sku, category, onlyActive)")
	public List<ProductResponse> search(
			@RequestParam(required = false) String q,
			@RequestParam(required = false) String category,
			@RequestParam(defaultValue = "false") boolean onlyActive) {
		return service.search(q, category, onlyActive);
	}

	@GetMapping("/{id}")
	@Operation(summary = "Obtener producto por id")
	public ProductResponse findById(@PathVariable Long id) {
		return service.findById(id);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Crear producto")
	public ProductResponse create(@Valid @RequestBody ProductRequest request) {
		return service.create(request);
	}

	@PutMapping("/{id}")
	@Operation(summary = "Editar producto (precio/stock u otros campos; solo cambia lo que viene)")
	public ProductResponse update(@PathVariable Long id, @Valid @RequestBody ProductUpdateRequest request) {
		return service.update(id, request);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Eliminar producto")
	public void delete(@PathVariable Long id) {
		service.delete(id);
	}

	@PostMapping("/stock/decrease")
	@Operation(summary = "Uso interno (ms-orders): descontar stock de un pedido aceptado. 409 si falta stock")
	public List<ProductResponse> decrease(@Valid @RequestBody StockMovementRequest request) {
		return service.decrease(request);
	}

	@PostMapping("/stock/increase")
	@Operation(summary = "Uso interno (ms-orders): reponer stock de un pedido aceptado que se cancela")
	public List<ProductResponse> increase(@Valid @RequestBody StockMovementRequest request) {
		return service.increase(request);
	}
}
