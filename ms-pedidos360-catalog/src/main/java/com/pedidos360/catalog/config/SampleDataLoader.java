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

/** Carga productos de ejemplo solo si la tabla esta vacia (desactivar con APP_SEED_ENABLED=false). */
@Slf4j
@Configuration
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true", matchIfMissing = true)
public class SampleDataLoader {

	@Bean
	CommandLineRunner seedProducts(ProductRepository repository) {
		return args -> {
			if (repository.count() > 0) {
				return;
			}
			repository.saveAll(List.of(
					product("PAN-001", "Marraqueta (kg)", "Panaderia", 1990, 100),
					product("PAN-002", "Hallulla (kg)", "Panaderia", 1990, 100),
					product("PAS-001", "Kuchen de manzana", "Pasteleria", 7500, 20),
					product("PAS-002", "Torta tres leches", "Pasteleria", 15900, 10),
					product("CAF-001", "Cafe americano", "Cafeteria", 1800, 200),
					product("CAF-002", "Cappuccino", "Cafeteria", 2500, 200),
					product("SAN-001", "Sandwich ave palta", "Cafeteria", 3900, 40)));
			log.info("Catalogo inicial cargado ({} productos)", repository.count());
		};
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
