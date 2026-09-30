package com.pedidos360.report.repository;

import com.pedidos360.report.model.OrderFact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

public interface OrderFactRepository extends JpaRepository<OrderFact, Long> {

	List<OrderFact> findByCreatedAtGreaterThanEqual(LocalDateTime from);

	List<OrderFact> findByDeliveredAtGreaterThanEqual(LocalDateTime from);

	List<OrderFact> findByStatusIn(Collection<String> statuses);
}
