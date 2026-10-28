package com.pedidos360.orders.messaging.unsent;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UnsentMessageRepository extends JpaRepository<UnsentMessage, Long> {

	List<UnsentMessage> findTop50ByStatusOrderByIdAsc(UnsentStatus status);

	Optional<UnsentMessage> findByEventId(String eventId);
}
