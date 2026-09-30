package com.pedidos360.report;

import com.pedidos360.report.messaging.OrderEventsConsumer;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {"spring.kafka.listener.auto-startup=false", "spring.main.allow-bean-definition-overriding=true"})
@AutoConfigureMockMvc
class ReportFlowTest {

	static final ZoneId ZONE = ZoneId.of("America/Santiago");
	static final LocalDateTime NOW = LocalDateTime.of(2026, 9, 30, 18, 0);

	@TestConfiguration
	static class FixedClock {
		@Bean
		@Primary
		Clock clock() {
			return Clock.fixed(NOW.atZone(ZONE).toInstant(), ZONE);
		}
	}

	@Autowired
	OrderEventsConsumer consumer;

	@Autowired
	MockMvc mvc;

	@Test
	void kpisYTopProductosDesdeEventos() throws Exception {
		// Pedido 1: creado 12:10, entregado 12:55 (lead time 45 min). 2 x prod 10 + 1 x prod 11 = 5500
		consume(1, "a1", "OrderCreated", "CREADO", "2026-09-30T12:10:00", null, 5500, 2, 1);
		consume(1, "a2", "OrderDelivered", "ENTREGADO", "2026-09-30T12:10:00", "2026-09-30T12:55:00", 5500, 2, 1);
		// Reentrega del mismo evento: sin efecto
		consume(1, "a2", "OrderDelivered", "ENTREGADO", "2026-09-30T12:10:00", "2026-09-30T12:55:00", 5500, 2, 1);
		// Pedido 2: activo (ACEPTADO) creado 13:20. 3 x prod 10 = 4500 (+0 prod 11)
		consume(2, "b1", "OrderAccepted", "ACEPTADO", "2026-09-30T13:20:00", null, 4500, 3, 0);
		// Pedido 3: cancelado, no suma ventas
		consume(3, "c1", "OrderCancelled", "CANCELADO", "2026-09-30T13:40:00", null, 9999, 9, 9);
		// Pedido 4: fuera del rango de 24h
		consume(4, "d1", "OrderCreated", "CREADO", "2026-09-20T10:00:00", null, 1000, 1, 0);

		mvc.perform(get("/api/report/kpis").param("range", "last24h"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.totalOrders").value(3))
				.andExpect(jsonPath("$.deliveredOrders").value(1))
				.andExpect(jsonPath("$.cancelledOrders").value(1))
				.andExpect(jsonPath("$.totalSales").value(10000))
				.andExpect(jsonPath("$.averageTicket").value(5000))
				.andExpect(jsonPath("$.leadTime.averageMinutes").value(45.0))
				.andExpect(jsonPath("$.activeByStatus.ACEPTADO").value(1))
				// el pedido 4 sigue activo aunque este fuera del rango
				.andExpect(jsonPath("$.activeByStatus.CREADO").value(1))
				.andExpect(jsonPath("$.salesByHour.length()").value(2))
				.andExpect(jsonPath("$.salesByHour[0].sales").value(5500));

		mvc.perform(get("/api/report/top-products").param("range", "last7d"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].productId").value(10))
				.andExpect(jsonPath("$[0].quantity").value(5))
				.andExpect(jsonPath("$[0].orders").value(2));

		mvc.perform(get("/api/report/kpis").param("range", "ayer")).andExpect(status().isBadRequest());
	}

	private void consume(long orderId, String eventId, String type, String status, String createdAt, String deliveredAt,
			int total, int qty10, int qty11) throws Exception {
		String items = "{\"productId\":10,\"quantity\":%d,\"unitPrice\":1500,\"subtotal\":%d}".formatted(qty10, qty10 * 1500)
				+ (qty11 > 0 ? ",{\"productId\":11,\"quantity\":%d,\"unitPrice\":2500,\"subtotal\":%d}".formatted(qty11, qty11 * 2500) : "");
		String json = """
				{"type":"%s","eventId":"%s","timestamp":"%s","orderId":%d,"status":"%s",
				 "order":{"id":%d,"storeId":1,"status":"%s","total":%d,"items":[%s],
				          "createdAt":"%s","deliveredAt":%s,"updatedAt":"%s"}}
				""".formatted(type, eventId, java.time.Instant.now(), orderId, status, orderId, status, total, items,
				createdAt, deliveredAt == null ? "null" : "\"" + deliveredAt + "\"", createdAt);
		consumer.onOrderEvent(new ConsumerRecord<>("orders.events", 0, 0, String.valueOf(orderId), json));
	}
}
