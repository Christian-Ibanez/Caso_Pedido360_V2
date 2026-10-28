package com.pedidos360.mqadmin;

import com.pedidos360.mqadmin.controller.BindingController;
import com.pedidos360.mqadmin.controller.ExchangeController;
import com.pedidos360.mqadmin.controller.QueueController;
import com.pedidos360.mqadmin.dto.QueueResponse;
import com.pedidos360.mqadmin.exception.ResourceConflictException;
import com.pedidos360.mqadmin.exception.ResourceNotFoundException;
import com.pedidos360.mqadmin.service.RabbitAdminService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** API REST: verbos, codigos HTTP y validacion de la entrada antes de llegar a RabbitMQ. */
@WebMvcTest(controllers = { QueueController.class, ExchangeController.class, BindingController.class })
class MqAdminControllerTest {

	@Autowired
	MockMvc mvc;

	@MockitoBean
	RabbitAdminService service;

	private org.springframework.test.web.servlet.ResultActions postJson(String path, String json) throws Exception {
		return mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(json));
	}

	@Test
	void creaColaValidaConLocation() throws Exception {
		when(service.createQueue(any())).thenReturn(new QueueResponse("q.cmd.sms", true, false, 0, 0, 0, 0, Map.of(), false));
		postJson("/api/mq/queues", """
				{"name":"q.cmd.sms","deadLetterExchange":"cmd.dead.dlx","deadLetterRoutingKey":"sms.send"}""")
				.andExpect(status().isCreated())
				.andExpect(header().string("Location", org.hamcrest.Matchers.endsWith("/api/mq/queues/q.cmd.sms")))
				.andExpect(jsonPath("$.name").value("q.cmd.sms"));
	}

	@Test
	void rechazaColasConNombreVacioReservadoOInvalido() throws Exception {
		postJson("/api/mq/queues", "{\"name\":\"\"}")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.name").exists());
		postJson("/api/mq/queues", "{\"name\":\"amq.mia\"}").andExpect(status().isBadRequest());
		postJson("/api/mq/queues", "{\"name\":\"cola con espacios\"}").andExpect(status().isBadRequest());
		postJson("/api/mq/queues", "{\"name\":\".empieza-con-punto\"}").andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	@Test
	void rechazaConfiguracionesInvalidasDeCola() throws Exception {
		// routing key de dead-letter sin exchange de dead-letter
		postJson("/api/mq/queues", "{\"name\":\"q.x\",\"deadLetterRoutingKey\":\"x\"}")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.deadLetterConsistent").exists());
		// durable y auto delete a la vez
		postJson("/api/mq/queues", "{\"name\":\"q.x\",\"durable\":true,\"autoDelete\":true}").andExpect(status().isBadRequest());
		postJson("/api/mq/queues", "{\"name\":\"q.x\",\"messageTtlMs\":-5}").andExpect(status().isBadRequest());
		postJson("/api/mq/queues", "{\"name\":\"q.x\",\"maxLength\":0}").andExpect(status().isBadRequest());
		postJson("/api/mq/queues", "{\"name\":").andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	@Test
	void rechazaExchangeConTipoInvalido() throws Exception {
		postJson("/api/mq/exchanges", "{\"name\":\"cmd.sms\",\"type\":\"rapido\"}")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.type").exists());
		postJson("/api/mq/exchanges", "{\"name\":\"cmd.sms\"}").andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	@Test
	void rechazaBindingConRoutingKeyInvalida() throws Exception {
		postJson("/api/mq/bindings", "{\"exchange\":\"cmd.topic\",\"queue\":\"q.cmd.sms\",\"routingKey\":\"sms send\"}")
				.andExpect(status().isBadRequest());
		postJson("/api/mq/bindings", "{\"exchange\":\"\",\"queue\":\"q.cmd.sms\"}").andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	@Test
	void eliminarResponde204Y404Y409() throws Exception {
		mvc.perform(delete("/api/mq/queues/q.temp")).andExpect(status().isNoContent());
		verify(service).deleteQueue("q.temp", true);

		doThrow(new ResourceNotFoundException("La cola 'q.nada' no existe")).when(service).deleteQueue("q.nada", true);
		mvc.perform(delete("/api/mq/queues/q.nada"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.detail").value("La cola 'q.nada' no existe"));

		doThrow(new ResourceConflictException("protegida")).when(service).deleteExchange("cmd.direct");
		mvc.perform(delete("/api/mq/exchanges/cmd.direct")).andExpect(status().isConflict());
	}

	@Test
	void eliminarBindingExigeExchangeYCola() throws Exception {
		mvc.perform(delete("/api/mq/bindings").param("exchange", "cmd.topic")).andExpect(status().isBadRequest());
		mvc.perform(delete("/api/mq/bindings").param("exchange", "cmd.topic").param("queue", "q.cmd.sms").param("routingKey", "sms.#"))
				.andExpect(status().isNoContent());
		verify(service).deleteBinding("cmd.topic", "q.cmd.sms", "sms.#");
	}
}
