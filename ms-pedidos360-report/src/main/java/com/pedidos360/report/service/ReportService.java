package com.pedidos360.report.service;

import com.pedidos360.report.dto.KpiResponse;
import com.pedidos360.report.dto.TopProductResponse;
import com.pedidos360.report.model.OrderFact;
import com.pedidos360.report.model.OrderLineFact;
import com.pedidos360.report.repository.OrderFactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/** Agregaciones de solo lectura sobre el modelo alimentado por Kafka: nunca llama a ms-orders (no bloquea el core). */
@Service
@RequiredArgsConstructor
public class ReportService {

	public static final List<String> ACTIVE_STATUSES = List.of("CREADO", "ACEPTADO", "EN_PREPARACION", "DESPACHADO");
	private static final String CANCELLED = "CANCELADO";

	private final OrderFactRepository repository;
	private final Clock clock;

	@Transactional(readOnly = true)
	public KpiResponse kpis(String rangeParam) {
		ReportRange range = ReportRange.parse(rangeParam, LocalDateTime.now(clock));
		List<OrderFact> created = repository.findByCreatedAtGreaterThanEqual(range.from());
		List<OrderFact> notCancelled = created.stream().filter(o -> !CANCELLED.equals(o.getStatus())).toList();
		List<OrderFact> delivered = deliveredIn(range);

		BigDecimal totalSales = sum(notCancelled);
		BigDecimal averageTicket = notCancelled.isEmpty() ? BigDecimal.ZERO
				: totalSales.divide(BigDecimal.valueOf(notCancelled.size()), 2, RoundingMode.HALF_UP);

		Map<String, Long> active = new LinkedHashMap<>();
		ACTIVE_STATUSES.forEach(s -> active.put(s, 0L));
		repository.findByStatusIn(ACTIVE_STATUSES).forEach(o -> active.merge(o.getStatus(), 1L, Long::sum));

		return new KpiResponse(range.name(), range.from(), range.to(),
				created.size(),
				delivered.size(),
				created.stream().filter(o -> CANCELLED.equals(o.getStatus())).count(),
				totalSales,
				averageTicket,
				leadTime(delivered),
				active,
				salesByHour(notCancelled),
				leadTimeByHour(delivered));
	}

	@Transactional(readOnly = true)
	public List<KpiResponse.SalesByHour> salesByHour(String rangeParam) {
		ReportRange range = ReportRange.parse(rangeParam, LocalDateTime.now(clock));
		return salesByHour(repository.findByCreatedAtGreaterThanEqual(range.from()).stream()
				.filter(o -> !CANCELLED.equals(o.getStatus())).toList());
	}

	@Transactional(readOnly = true)
	public KpiResponse.LeadTime leadTime(String rangeParam) {
		return leadTime(deliveredIn(ReportRange.parse(rangeParam, LocalDateTime.now(clock))));
	}

	@Transactional(readOnly = true)
	public List<TopProductResponse> topProducts(String rangeParam, int limit) {
		ReportRange range = ReportRange.parse(rangeParam, LocalDateTime.now(clock));
		record Acc(long quantity, BigDecimal sales, Set<Long> orders) {
		}
		Map<Long, Acc> byProduct = new HashMap<>();
		for (OrderFact order : repository.findByCreatedAtGreaterThanEqual(range.from())) {
			if (CANCELLED.equals(order.getStatus())) {
				continue;
			}
			for (OrderLineFact line : order.getLines()) {
				byProduct.merge(line.getProductId(),
						new Acc(line.getQuantity(), line.getSubtotal(), new HashSet<>(Set.of(order.getOrderId()))),
						(a, b) -> {
							a.orders().addAll(b.orders());
							return new Acc(a.quantity() + b.quantity(), a.sales().add(b.sales()), a.orders());
						});
			}
		}
		return byProduct.entrySet().stream()
				.map(e -> new TopProductResponse(e.getKey(), e.getValue().quantity(), e.getValue().sales(), e.getValue().orders().size()))
				.sorted(Comparator.comparingLong(TopProductResponse::quantity).reversed()
						.thenComparing(TopProductResponse::sales, Comparator.reverseOrder()))
				.limit(Math.max(1, Math.min(limit, 100)))
				.toList();
	}

	private List<OrderFact> deliveredIn(ReportRange range) {
		return repository.findByDeliveredAtGreaterThanEqual(range.from()).stream()
				.filter(o -> o.getCreatedAt() != null)
				.toList();
	}

	private static KpiResponse.LeadTime leadTime(List<OrderFact> delivered) {
		DoubleSummaryStatistics stats = delivered.stream().mapToDouble(ReportService::leadMinutes).summaryStatistics();
		if (stats.getCount() == 0) {
			return new KpiResponse.LeadTime(0, null, null, null);
		}
		return new KpiResponse.LeadTime(stats.getCount(), round(stats.getAverage()), round(stats.getMin()), round(stats.getMax()));
	}

	private static List<KpiResponse.SalesByHour> salesByHour(List<OrderFact> orders) {
		return orders.stream()
				.collect(Collectors.groupingBy(o -> o.getCreatedAt().truncatedTo(ChronoUnit.HOURS), TreeMap::new, Collectors.toList()))
				.entrySet().stream()
				.map(e -> new KpiResponse.SalesByHour(e.getKey(), e.getValue().size(), sum(e.getValue())))
				.toList();
	}

	private static List<KpiResponse.LeadTimeByHour> leadTimeByHour(List<OrderFact> delivered) {
		return delivered.stream()
				.collect(Collectors.groupingBy(o -> o.getDeliveredAt().truncatedTo(ChronoUnit.HOURS), TreeMap::new,
						Collectors.averagingDouble(ReportService::leadMinutes)))
				.entrySet().stream()
				.map(e -> new KpiResponse.LeadTimeByHour(e.getKey(),
						delivered.stream().filter(o -> o.getDeliveredAt().truncatedTo(ChronoUnit.HOURS).equals(e.getKey())).count(),
						round(e.getValue())))
				.toList();
	}

	private static double leadMinutes(OrderFact o) {
		return Duration.between(o.getCreatedAt(), o.getDeliveredAt()).toSeconds() / 60.0;
	}

	private static BigDecimal sum(List<OrderFact> orders) {
		return orders.stream().map(OrderFact::getTotal).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
	}

	private static double round(double value) {
		return Math.round(value * 10.0) / 10.0;
	}
}
