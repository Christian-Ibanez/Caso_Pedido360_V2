package com.pedidos360.notify;

import com.pedidos360.notify.consumer.CommandConsumer;
import com.pedidos360.notify.inapp.NotificationRepository;
import com.rabbitmq.client.Channel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Flujo de la campana por RabbitMQ: pedido nuevo -> administradores; pedido confirmado -> "en proceso" al cliente.
 * Cada usuario ve solo lo suyo (el BFF manda X-User-Email y X-User-Roles).
 */
@SpringBootTest(properties = "spring.rabbitmq.listener.simple.auto-startup=false")
@AutoConfigureMockMvc
class InAppNotificationTest {

	@Autowired
	CommandConsumer consumer;

	@Autowired
	NotificationRepository repository;

	@Autowired
	MockMvc mvc;

	@BeforeEach
	void clean() {
		repository.deleteAll();
	}

	@Test
	void pedidoNuevoLlegaAlAdministradorYLaConfirmacionAlCliente() throws Exception {
		Channel channel = mock(Channel.class);
		consumer.onInApp(inApp(1, "n-1", "ADMIN", null, 27, "Nuevo pedido #27"), channel);
		consumer.onInApp(inApp(2, "n-2", "CUSTOMER", "Ana@Mail.com", 27, "Tu pedido #27 está en proceso"), channel);
		verify(channel).basicAck(1, false);
		verify(channel).basicAck(2, false);

		mvc.perform(get("/api/notifications").header("X-User-Email", "admin@p360.cl").header("X-User-Roles", "Admin"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.unread").value(1))
				.andExpect(jsonPath("$.items[0].title").value("Nuevo pedido #27"))
				.andExpect(jsonPath("$.items[0].orderId").value(27));

		mvc.perform(get("/api/notifications").header("X-User-Email", "ana@mail.com"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.unread").value(1))
				.andExpect(jsonPath("$.items.length()").value(1))
				.andExpect(jsonPath("$.items[0].title").value("Tu pedido #27 está en proceso"));

		// Otro cliente no ve notificaciones ajenas
		mvc.perform(get("/api/notifications").header("X-User-Email", "otro@mail.com"))
				.andExpect(jsonPath("$.items.length()").value(0));
	}

	@Test
	void duplicadoNoSeGuardaDosVecesYFallaVaALaDlq() throws Exception {
		Channel channel = mock(Channel.class);
		consumer.onInApp(inApp(3, "n-3", "ADMIN", null, 30, "Nuevo pedido #30"), channel);
		consumer.onInApp(inApp(4, "n-3", "ADMIN", null, 30, "Nuevo pedido #30"), channel);
		assertThat(repository.count()).isEqualTo(1);

		// Cliente sin destinatario: NACK sin requeue -> q.notify.inapp.dlq
		consumer.onInApp(inApp(5, "n-5", "CUSTOMER", null, 30, "Sin destinatario"), channel);
		verify(channel).basicNack(5, false, false);
	}

	@Test
	void marcarLeidaSoloLaPropia() throws Exception {
		consumer.onInApp(inApp(6, "n-6", "CUSTOMER", "ana@mail.com", 31, "Tu pedido #31 está en proceso"), mock(Channel.class));
		Long id = repository.findAll().get(0).getId();

		mvc.perform(post("/api/notifications/" + id + "/read").header("X-User-Email", "otro@mail.com"))
				.andExpect(status().isNotFound());
		mvc.perform(post("/api/notifications/" + id + "/read").header("X-User-Email", "ana@mail.com"))
				.andExpect(status().isNoContent());
		mvc.perform(get("/api/notifications").header("X-User-Email", "ana@mail.com"))
				.andExpect(jsonPath("$.unread").value(0))
				.andExpect(jsonPath("$.items[0].read").value(true));
	}

	private static Message inApp(long tag, String eventId, String audience, String recipient, long orderId, String title) {
		String rec = recipient == null ? "null" : "\"" + recipient + "\"";
		String body = """
				{"type":"InAppNotify","eventId":"%s","timestamp":"2026-10-28T12:00:00Z","traceId":"t","correlationId":"c",
				 "payload":{"audience":"%s","recipient":%s,"orderId":%d,"status":"CREADO","title":"%s","body":"detalle"}}
				""".formatted(eventId, audience, rec, orderId, title);
		MessageProperties props = new MessageProperties();
		props.setDeliveryTag(tag);
		props.setConsumerQueue("q.notify.inapp");
		return new Message(body.getBytes(StandardCharsets.UTF_8), props);
	}
}
