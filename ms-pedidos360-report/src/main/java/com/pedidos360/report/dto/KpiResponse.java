package com.pedidos360.report.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Panel de KPIs del caso: ventas por hora, lead time (creado -> entregado) y estados activos.
 * Ventas = total de los pedidos creados en el rango que no fueron cancelados.
 */
public record KpiResponse(
		String range,
		LocalDateTime from,
		LocalDateTime to,
		long totalOrders,
		long deliveredOrders,
		long cancelledOrders,
		BigDecimal totalSales,
		BigDecimal averageTicket,
		LeadTime leadTime,
		Map<String, Long> activeByStatus,
		List<SalesByHour> salesByHour,
		List<LeadTimeByHour> leadTimeByHour
) {
	/** Minutos entre createdAt y deliveredAt de los pedidos entregados en el rango. */
	public record LeadTime(long deliveredOrders, Double averageMinutes, Double minMinutes, Double maxMinutes) {
	}

	public record SalesByHour(LocalDateTime hour, long orders, BigDecimal sales) {
	}

	public record LeadTimeByHour(LocalDateTime hour, long deliveredOrders, double averageMinutes) {
	}
}
