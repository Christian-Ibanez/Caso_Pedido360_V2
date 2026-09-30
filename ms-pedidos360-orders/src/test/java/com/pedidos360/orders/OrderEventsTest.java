package com.pedidos360.orders;

import com.pedidos360.orders.client.CatalogClient;
import com.pedidos360.orders.messaging.OrderEvent;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Cada cambio publica su evento de negocio con quien/desde donde, y aceptar/cancelar mueve stock en catalogo. */
@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:ordereventsdb;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@RecordApplicationEvents
class OrderEventsTest {

	@Autowired
	MockMvc mvc;

	@Autowired
	ApplicationEvents events;

	@MockitoBean
	CatalogClient catalogClient;

	@Test
	void eventosYStock() throws Exception {
		String body = mvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON)
						.header("X-User", "operador@pedidos360.cl")
						.header("X-Forwarded-For", "10.0.0.7")
						.content("""
								{"storeId":1,"customerName":"Ana","customerEmail":"ana@mail.com",
								 "items":[{"productId":10,"quantity":2,"unitPrice":1500}]}
								"""))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		long id = Long.parseLong(body.replaceAll("^\\{\"id\":(\\d+).*", "$1").trim());

		mvc.perform(put("/api/orders/" + id + "/status").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ACEPTADO\"}"))
				.andExpect(status().isOk());
		verify(catalogClient).decreaseStock(any());

		mvc.perform(put("/api/orders/" + id + "/status").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"CANCELADO\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("CANCELADO"));
		verify(catalogClient).increaseStock(any());

		assertThat(events.stream(OrderEvent.class).map(OrderEvent::type))
				.containsExactly("OrderCreated", "OrderAccepted", "OrderCancelled");
		OrderEvent created = events.stream(OrderEvent.class).findFirst().orElseThrow();
		assertThat(created.actor()).isEqualTo("operador@pedidos360.cl");
		assertThat(created.origin()).isEqualTo("10.0.0.7");
		assertThat(created.eventId()).isNotBlank();
		assertThat(created.order().items()).hasSize(1);
	}

	@Test
	void sinStockNoSeAcepta() throws Exception {
		doThrow(new com.pedidos360.orders.exception.InvalidStatusTransitionException("Stock insuficiente"))
				.when(catalogClient).decreaseStock(any());
		String body = mvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON).content("""
						{"storeId":1,"customerName":"Ana","customerEmail":"ana@mail.com",
						 "items":[{"productId":10,"quantity":99,"unitPrice":1500}]}
						"""))
				.andReturn().getResponse().getContentAsString();
		long id = Long.parseLong(body.replaceAll("^\\{\"id\":(\\d+).*", "$1").trim());

		mvc.perform(put("/api/orders/" + id + "/status").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ACEPTADO\"}"))
				.andExpect(status().isConflict());
		mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/orders/" + id))
				.andExpect(jsonPath("$.status").value("CREADO"));
	}
}
