package com.pedidos360.catalog.repository;

import com.pedidos360.catalog.model.Product;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.ArrayList;
import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {

	boolean existsBySku(String sku);

	/** Filtros opcionales: texto (nombre/sku), categoria y solo activos. */
	static Specification<Product> filter(String q, String category, boolean onlyActive) {
		return (root, query, cb) -> {
			List<Predicate> predicates = new ArrayList<>();
			if (q != null && !q.isBlank()) {
				String like = "%" + q.trim().toLowerCase() + "%";
				predicates.add(cb.or(cb.like(cb.lower(root.get("name")), like), cb.like(cb.lower(root.get("sku")), like)));
			}
			if (category != null && !category.isBlank()) {
				predicates.add(cb.equal(cb.lower(root.get("category")), category.trim().toLowerCase()));
			}
			if (onlyActive) {
				predicates.add(cb.isTrue(root.get("active")));
			}
			return cb.and(predicates.toArray(Predicate[]::new));
		};
	}
}
