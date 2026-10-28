package com.pedidos360.notify.inapp;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

	boolean existsByEventId(String eventId);

	List<Notification> findByAudienceOrderByIdDesc(String audience, Pageable page);

	List<Notification> findByAudienceAndRecipientOrderByIdDesc(String audience, String recipient, Pageable page);

	long countByAudienceAndReadAtIsNull(String audience);

	long countByAudienceAndRecipientAndReadAtIsNull(String audience, String recipient);

	@Modifying
	@Query("update Notification n set n.readAt = :now where n.audience = 'ADMIN' and n.readAt is null")
	int markAllAdminRead(@Param("now") Instant now);

	@Modifying
	@Query("update Notification n set n.readAt = :now where n.audience = 'CUSTOMER' and n.recipient = :recipient and n.readAt is null")
	int markAllCustomerRead(@Param("recipient") String recipient, @Param("now") Instant now);
}
