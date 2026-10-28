package com.pedidos360.catalog.config;

import com.pedidos360.catalog.model.Product;
import com.pedidos360.catalog.repository.ProductRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;
import java.util.List;

/**
 * Carga el catalogo de ejemplo agregando solo los SKU que todavia no existen
 * (no toca productos ya creados ni sus precios o stock). Desactivar con APP_SEED_ENABLED=false.
 */
@Slf4j
@Configuration
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true", matchIfMissing = true)
public class SampleDataLoader {

	static final List<Product> SAMPLE = List.of(
			product("PAN-001", "Marraqueta (kg)", "Panaderia", 1990, 100),
			product("PAN-002", "Hallulla (kg)", "Panaderia", 1990, 100),
			product("PAN-003", "Pan amasado (kg)", "Panaderia", 2490, 80),
			product("PAN-004", "Dobladitas (kg)", "Panaderia", 2290, 60),
			product("PAN-005", "Pan integral con semillas (kg)", "Panaderia", 2890, 45),
			product("PAN-006", "Canasta de pan batido (10 u)", "Panaderia", 2990, 40),
			product("PAN-007", "Empanada de pino", "Panaderia", 2800, 50),
			product("PAN-008", "Sopaipillas (6 u)", "Panaderia", 1500, 30),
			product("PAS-001", "Kuchen de manzana", "Pasteleria", 7500, 20),
			product("PAS-002", "Torta tres leches", "Pasteleria", 15900, 10),
			product("PAS-003", "Pie de limón", "Pasteleria", 8900, 15),
			product("PAS-004", "Torta mil hojas", "Pasteleria", 18900, 8),
			product("PAS-005", "Brazo de reina con manjar", "Pasteleria", 6500, 18),
			product("PAS-006", "Alfajor de manjar", "Pasteleria", 990, 120),
			product("PAS-007", "Berlín de crema pastelera", "Pasteleria", 1200, 60),
			product("CAF-001", "Cafe americano", "Cafeteria", 1800, 200),
			product("CAF-002", "Cappuccino", "Cafeteria", 2500, 200),
			product("CAF-003", "Latte", "Cafeteria", 2800, 180),
			product("CAF-004", "Mocaccino", "Cafeteria", 3200, 150),
			product("CAF-005", "Té Ceylán", "Cafeteria", 1200, 150),
			product("SAN-001", "Sandwich ave palta", "Sandwiches", 3900, 40),
			product("SAN-002", "Barros Luco", "Sandwiches", 5900, 30),
			product("SAN-003", "Chacarero", "Sandwiches", 6500, 30),
			product("SAN-004", "Ave mayo", "Sandwiches", 3500, 35),
			product("BEB-001", "Jugo natural de naranja", "Bebidas", 2900, 60),
			product("BEB-002", "Mote con huesillo", "Bebidas", 2500, 40),
			product("BEB-003", "Agua mineral 500 ml", "Bebidas", 1000, 150),
			product("BEB-004", "Bebida en lata 350 ml", "Bebidas", 1200, 120));

	@Bean
	CommandLineRunner seedProducts(ProductRepository repository) {
		return args -> seedMissing(repository);
	}

	/** Inserta los productos de ejemplo cuyo SKU no esta en la tabla. Devuelve cuantos agrego. */
	static int seedMissing(ProductRepository repository) {
		List<Product> missing = SAMPLE.stream()
				.filter(p -> !repository.existsBySku(p.getSku()))
				.map(SampleDataLoader::copy)
				.toList();
		if (!missing.isEmpty()) {
			repository.saveAll(missing);
			log.info("Catalogo de ejemplo: {} productos agregados (total {})", missing.size(), repository.count());
		}
		return missing.size();
	}

	private static Product copy(Product p) {
		return product(p.getSku(), p.getName(), p.getCategory(), p.getPrice().intValue(), p.getStock());
	}

	private static Product product(String sku, String name, String category, int price, int stock) {
		Product p = new Product();
		p.setSku(sku);
		p.setName(name);
		p.setCategory(category);
		p.setPrice(BigDecimal.valueOf(price));
		p.setStock(stock);
		p.setActive(true);
		return p;
	}
}
