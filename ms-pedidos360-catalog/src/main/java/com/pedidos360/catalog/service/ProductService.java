package com.pedidos360.catalog.service;

import com.pedidos360.catalog.dto.ProductRequest;
import com.pedidos360.catalog.dto.ProductResponse;
import com.pedidos360.catalog.dto.ProductUpdateRequest;
import com.pedidos360.catalog.dto.StockMovementRequest;
import com.pedidos360.catalog.exception.DuplicateSkuException;
import com.pedidos360.catalog.exception.InsufficientStockException;
import com.pedidos360.catalog.exception.ProductNotFoundException;
import com.pedidos360.catalog.model.Product;
import com.pedidos360.catalog.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductService {

	private final ProductRepository repository;

	@Transactional(readOnly = true)
	public List<ProductResponse> search(String q, String category, boolean onlyActive) {
		return repository.findAll(ProductRepository.filter(q, category, onlyActive), Sort.by("name"))
				.stream().map(ProductResponse::from).toList();
	}

	@Transactional(readOnly = true)
	public ProductResponse findById(Long id) {
		return ProductResponse.from(get(id));
	}

	@Transactional
	public ProductResponse create(ProductRequest request) {
		if (repository.existsBySku(request.sku())) {
			throw new DuplicateSkuException(request.sku());
		}
		Product product = new Product();
		product.setSku(request.sku());
		product.setName(request.name());
		product.setDescription(request.description());
		product.setCategory(request.category());
		product.setPrice(request.price());
		product.setStock(request.stock());
		product.setActive(request.active() == null || request.active());
		return ProductResponse.from(repository.save(product));
	}

	@Transactional
	public ProductResponse update(Long id, ProductUpdateRequest request) {
		Product product = get(id);
		if (request.name() != null) product.setName(request.name());
		if (request.description() != null) product.setDescription(request.description());
		if (request.category() != null) product.setCategory(request.category());
		if (request.price() != null) product.setPrice(request.price());
		if (request.stock() != null) product.setStock(request.stock());
		if (request.active() != null) product.setActive(request.active());
		return ProductResponse.from(repository.save(product));
	}

	@Transactional
	public void delete(Long id) {
		repository.delete(get(id));
	}

	/** Regla del caso: el stock decrece al aceptar un pedido. Todo o nada. */
	@Transactional
	public List<ProductResponse> decrease(StockMovementRequest request) {
		Map<Long, Integer> quantities = groupByProduct(request);
		List<Product> products = load(quantities);
		for (Product p : products) {
			int requested = quantities.get(p.getId());
			if (!p.getActive()) {
				throw new InsufficientStockException("El producto " + p.getId() + " (" + p.getName() + ") no esta activo");
			}
			if (p.getStock() < requested) {
				throw new InsufficientStockException("Stock insuficiente para " + p.getName()
						+ " (id " + p.getId() + "): disponible " + p.getStock() + ", solicitado " + requested);
			}
		}
		products.forEach(p -> p.setStock(p.getStock() - quantities.get(p.getId())));
		log.info("Stock descontado por pedido {}: {}", request.orderId(), quantities);
		return repository.saveAll(products).stream().map(ProductResponse::from).toList();
	}

	/** Devuelve stock cuando se cancela un pedido que ya habia sido aceptado. */
	@Transactional
	public List<ProductResponse> increase(StockMovementRequest request) {
		Map<Long, Integer> quantities = groupByProduct(request);
		List<Product> products = load(quantities);
		products.forEach(p -> p.setStock(p.getStock() + quantities.get(p.getId())));
		log.info("Stock repuesto por pedido {}: {}", request.orderId(), quantities);
		return repository.saveAll(products).stream().map(ProductResponse::from).toList();
	}

	private Map<Long, Integer> groupByProduct(StockMovementRequest request) {
		return request.items().stream().collect(Collectors.groupingBy(
				StockMovementRequest.Item::productId, Collectors.summingInt(StockMovementRequest.Item::quantity)));
	}

	private List<Product> load(Map<Long, Integer> quantities) {
		return quantities.keySet().stream().map(this::get).toList();
	}

	private Product get(Long id) {
		return repository.findById(id).orElseThrow(() -> new ProductNotFoundException(id));
	}
}
