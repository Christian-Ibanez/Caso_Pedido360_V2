package com.pedidos360.report.service;

import com.pedidos360.report.messaging.OrderEventMessage;
import com.pedidos360.report.model.OrderFact;
import com.pedidos360.report.model.OrderLineFact;
import com.pedidos360.report.repository.OrderFactRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

/**
 * Actualiza el modelo de lectura con cada evento. Idempotente: cada evento trae la foto completa del pedido,
 * y un evento repetido o mas antiguo que el ultimo aplicado se ignora.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderFactProjector {

	private final OrderFactRepository repository;

	@Transactional
	public void apply(OrderEventMessage event) {
		if ("OrderDeleted".equals(event.type())) {
			repository.findById(event.orderId()).ifPresent(repository::delete);
			return;
		}
		OrderEventMessage.Order order = event.order();
		if (order == null || order.id() == null) {
			throw new IllegalArgumentException("Evento " + event.eventId() + " sin la foto del pedido");
		}
		OrderFact fact = repository.findById(order.id()).orElseGet(() -> {
			OrderFact f = new OrderFact();
			f.setOrderId(order.id());
			return f;
		});
		if (event.eventId().equals(fact.getLastEventId())
				|| (fact.getLastEventAt() != null && event.timestamp().isBefore(fact.getLastEventAt()))) {
			log.info("Evento {} repetido o atrasado para el pedido {}, se ignora", event.eventId(), order.id());
			return;
		}
		fact.setStoreId(order.storeId());
		fact.setStatus(order.status() != null ? order.status() : event.status());
		fact.setTotal(order.total() != null ? order.total() : BigDecimal.ZERO);
		fact.setCreatedAt(order.createdAt());
		fact.setAcceptedAt(order.acceptedAt());
		fact.setDispatchedAt(order.dispatchedAt());
		fact.setDeliveredAt(order.deliveredAt());
		if ("CANCELADO".equals(fact.getStatus()) && fact.getCancelledAt() == null) {
			fact.setCancelledAt(order.updatedAt() != null ? order.updatedAt()
					: LocalDateTime.ofInstant(event.timestamp(), ZoneId.systemDefault()));
		}
		fact.setLastEventAt(event.timestamp());
		fact.setLastEventId(event.eventId());
		List<OrderLineFact> lines = order.items() == null ? List.of() : order.items().stream().map(i -> {
			OrderLineFact line = new OrderLineFact();
			line.setProductId(i.productId());
			line.setQuantity(i.quantity());
			line.setSubtotal(i.subtotal() != null ? i.subtotal()
					: i.unitPrice().multiply(BigDecimal.valueOf(i.quantity())));
			return line;
		}).toList();
		fact.replaceLines(lines);
		repository.save(fact);
		log.info("KPIs: pedido {} -> {} ({})", order.id(), fact.getStatus(), event.type());
	}
}
