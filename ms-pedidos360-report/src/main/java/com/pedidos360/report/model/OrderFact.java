package com.pedidos360.report.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** Modelo de lectura: ultima foto conocida de cada pedido, armada desde orders.events (no consulta a ms-orders). */
@Entity
@Table(name = "P360_RPT_ORDERS", indexes = @Index(name = "IX_RPT_ORDERS_CREATED", columnList = "createdAt"))
@Getter
@Setter
@NoArgsConstructor
public class OrderFact {

	@Id
	private Long orderId;

	private Long storeId;

	@Column(nullable = false, length = 30)
	private String status;

	@Column(precision = 12, scale = 2)
	private BigDecimal total = BigDecimal.ZERO;

	private LocalDateTime createdAt;
	private LocalDateTime acceptedAt;
	private LocalDateTime dispatchedAt;
	private LocalDateTime deliveredAt;
	private LocalDateTime cancelledAt;

	/** Para ignorar eventos que llegan atrasados (fuera de orden). */
	private Instant lastEventAt;

	@Column(length = 64)
	private String lastEventId;

	@OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
	private List<OrderLineFact> lines = new ArrayList<>();

	public void replaceLines(List<OrderLineFact> newLines) {
		lines.clear();
		newLines.forEach(l -> {
			l.setOrder(this);
			lines.add(l);
		});
	}
}
