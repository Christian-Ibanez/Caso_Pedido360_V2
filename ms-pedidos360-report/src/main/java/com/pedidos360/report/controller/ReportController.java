package com.pedidos360.report.controller;

import com.pedidos360.report.dto.KpiResponse;
import com.pedidos360.report.dto.TopProductResponse;
import com.pedidos360.report.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Solo lectura. range: lastNh | lastNd (p. ej. last24h, last7d). */
@RestController
@RequestMapping("/api/report")
@RequiredArgsConstructor
@Tag(name = "Reporteria")
public class ReportController {

	private final ReportService service;

	@GetMapping("/kpis")
	@Operation(summary = "KPIs: pedidos, ventas, ticket promedio, lead time, estados activos, ventas y lead time por hora")
	public KpiResponse kpis(@RequestParam(defaultValue = "last24h") String range) {
		return service.kpis(range);
	}

	@GetMapping("/top-products")
	@Operation(summary = "Productos mas vendidos (por cantidad) en el rango")
	public List<TopProductResponse> topProducts(@RequestParam(defaultValue = "last7d") String range,
			@RequestParam(defaultValue = "5") int limit) {
		return service.topProducts(range, limit);
	}

	@GetMapping("/sales-by-hour")
	@Operation(summary = "Ventas por hora (para SalesChartComponent)")
	public List<KpiResponse.SalesByHour> salesByHour(@RequestParam(defaultValue = "last24h") String range) {
		return service.salesByHour(range);
	}

	@GetMapping("/lead-time")
	@Operation(summary = "Lead time en minutos (creado -> entregado) de los pedidos entregados en el rango")
	public KpiResponse.LeadTime leadTime(@RequestParam(defaultValue = "last24h") String range) {
		return service.leadTime(range);
	}
}
