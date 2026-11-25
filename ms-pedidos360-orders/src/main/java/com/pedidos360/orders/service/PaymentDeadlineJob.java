package com.pedidos360.orders.service;

import com.pedidos360.orders.model.CustomerOrder;
import com.pedidos360.orders.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Plazo de pago: cada `app.payment.check-ms` busca pedidos sin pagar creados hace mas de `app.payment.deadline`
 * (10 minutos por defecto) y los pasa a RECHAZADO. Si catalog no responde al reponer stock, el pedido queda
 * igual y se reintenta en la siguiente pasada.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentDeadlineJob {

	private final OrderRepository repository;
	private final OrderService service;

	@Value("${app.payment.deadline:10m}")
	private Duration deadline;

	@Scheduled(fixedDelayString = "${app.payment.check-ms:30000}", initialDelayString = "${app.payment.check-ms:30000}")
	public void rejectExpired() {
		LocalDateTime cutoff = LocalDateTime.now().minus(deadline);
		List<CustomerOrder> expired = repository.findByPaidAtIsNullAndStatusInAndCreatedAtBefore(OrderService.OPEN, cutoff);
		for (CustomerOrder order : expired) {
			try {
				if (service.rejectUnpaid(order.getId())) {
					log.info("[PAGO] pedido {} rechazado: sin pago después de {} min", order.getId(), deadline.toMinutes());
				}
			} catch (RuntimeException ex) {
				log.warn("[PAGO] no se pudo rechazar el pedido {} (se reintenta): {}", order.getId(), ex.getMessage());
			}
		}
	}

	public Duration deadline() {
		return deadline;
	}
}
