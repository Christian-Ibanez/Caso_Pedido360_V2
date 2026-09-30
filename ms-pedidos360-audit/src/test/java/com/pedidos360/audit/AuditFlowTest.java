package com.pedidos360.audit;

import com.pedidos360.audit.messaging.OrderEventsConsumer;
import com.pedidos360.audit.messaging.TimelinePublisher;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "spring.kafka.listener.auto-startup=false")
@AutoConfigureMockMvc
class AuditFlowTest {

	@Autowired
	OrderEventsConsumer consumer;

	@Autowired
	MockMvc mvc;

	@MockitoBean
	TimelinePublisher timelinePublisher;

	@Test
	void consumeEventosYLosExponeSoloLectura() throws Exception {
		consume(0, event("e-1", "OrderCreated", null, "CREADO", "cliente@mail.com", "2026-09-30T12:00:00Z"));
		consume(1, event("e-2", "OrderAccepted", "CREADO", "ACEPTADO", "operador@mail.com", "2026-09-30T12:05:00Z"));
		// Reentrega del mismo evento: no se duplica
		consume(1, event("e-2", "OrderAccepted", "CREADO", "ACEPTADO", "operador@mail.com", "2026-09-30T12:05:00Z"));
		verify(timelinePublisher, times(2)).publish(any());

		mvc.perform(get("/api/audit/orders/42/timeline"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2))
				.andExpect(jsonPath("$[0].eventType").value("OrderCreated"))
				.andExpect(jsonPath("$[1].summary").value("operador@mail.com acepto el pedido #42 (CREADO -> ACEPTADO) desde 10.0.0.7"));

		mvc.perform(get("/api/audit/events").param("user", "operador").param("type", "OrderAccepted"))
				.andExpect(jsonPath("$.length()").value(1));
		mvc.perform(get("/api/audit/events").param("from", "2026-09-30T12:01:00Z"))
				.andExpect(jsonPath("$.length()").value(1));
		mvc.perform(get("/api/audit/event-types")).andExpect(jsonPath("$.length()").value(2));

		// Solo lectura
		mvc.perform(post("/api/audit/events")).andExpect(status().isMethodNotAllowed());
	}

	@Test
	void mensajeInvalidoLanzaErrorParaIrAlDlt() {
		assertThatThrownBy(() -> consume(9, "{no es json")).isInstanceOf(Exception.class);
		assertThatThrownBy(() -> consume(10, "{\"type\":\"OrderCreated\"}")).isInstanceOf(IllegalArgumentException.class);
	}

	private void consume(long offset, String json) throws Exception {
		consumer.onOrderEvent(new ConsumerRecord<>("orders.events", 0, offset, "42", json));
	}

	private static String event(String id, String type, String prev, String status, String actor, String ts) {
		return """
				{"type":"%s","eventId":"%s","timestamp":"%s","traceId":"t1","correlationId":"c1",
				 "source":"ms-pedidos360-orders","actor":"%s","origin":"10.0.0.7","orderId":42,
				 "previousStatus":%s,"status":"%s","order":{"id":42,"total":5500}}
				""".formatted(type, id, ts, actor, prev == null ? "null" : "\"" + prev + "\"", status);
	}
}
