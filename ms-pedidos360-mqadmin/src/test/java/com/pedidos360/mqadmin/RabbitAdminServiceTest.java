package com.pedidos360.mqadmin;

import com.pedidos360.mqadmin.client.RabbitManagementClient;
import com.pedidos360.mqadmin.config.RabbitAdminProperties;
import com.pedidos360.mqadmin.dto.BindingRequest;
import com.pedidos360.mqadmin.dto.ExchangeRequest;
import com.pedidos360.mqadmin.dto.QueueRequest;
import com.pedidos360.mqadmin.exception.InvalidRequestException;
import com.pedidos360.mqadmin.exception.ResourceConflictException;
import com.pedidos360.mqadmin.exception.ResourceNotFoundException;
import com.pedidos360.mqadmin.service.RabbitAdminService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.core.AmqpAdmin;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.Exchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueInformation;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Reglas del administrador: no duplicar, no borrar la topologia del sistema y no aceptar combinaciones invalidas. */
class RabbitAdminServiceTest {

	private final AmqpAdmin admin = mock(AmqpAdmin.class);
	private final RabbitManagementClient management = mock(RabbitManagementClient.class);
	private final RabbitAdminProperties props = new RabbitAdminProperties("/", List.of("http://mq:15672"),
			List.of("q.cmd.", "q.notify."), List.of("cmd.", "amq."));
	private final RabbitAdminService service = new RabbitAdminService(admin, management, props);

	private static QueueRequest queue(String name) {
		return new QueueRequest(name, null, null, null, null, null, null);
	}

	private void exchangeExists(String name, String type) {
		when(management.exchange(name)).thenReturn(Optional.of(Map.of("name", name, "type", type)));
	}

	@Test
	void creaColaDurableConDeadLetter() {
		exchangeExists("cmd.dead.dlx", "direct");
		service.createQueue(new QueueRequest("q.sms", null, null, "cmd.dead.dlx", "sms.send", 60000L, 100));

		ArgumentCaptor<Queue> captor = ArgumentCaptor.forClass(Queue.class);
		verify(admin).declareQueue(captor.capture());
		Queue q = captor.getValue();
		assertThat(q.isDurable()).isTrue();
		assertThat(q.getArguments()).containsEntry("x-dead-letter-exchange", "cmd.dead.dlx")
				.containsEntry("x-dead-letter-routing-key", "sms.send")
				.containsEntry("x-message-ttl", 60000)
				.containsEntry("x-max-length", 100L);
	}

	@Test
	void noCreaColaDuplicadaNiConDeadLetterInexistente() {
		when(admin.getQueueInfo("q.cmd.email")).thenReturn(new QueueInformation("q.cmd.email", 0, 1));
		assertThatThrownBy(() -> service.createQueue(queue("q.cmd.email"))).isInstanceOf(ResourceConflictException.class);

		when(management.exchange("no.existe")).thenReturn(Optional.empty());
		assertThatThrownBy(() -> service.createQueue(new QueueRequest("q.nueva", null, null, "no.existe", null, null, null)))
				.isInstanceOf(ResourceNotFoundException.class);
		verify(admin, never()).declareQueue(any());
	}

	@Test
	void protegeLaTopologiaDelSistema() {
		assertThatThrownBy(() -> service.deleteQueue("q.cmd.email", false)).isInstanceOf(ResourceConflictException.class);
		assertThatThrownBy(() -> service.deleteQueue("q.cmd.email.dlq", false)).isInstanceOf(ResourceConflictException.class);
		assertThatThrownBy(() -> service.deleteExchange("cmd.direct")).isInstanceOf(ResourceConflictException.class);
		assertThatThrownBy(() -> service.deleteBinding("cmd.direct", "q.cmd.email", "email.send"))
				.isInstanceOf(ResourceConflictException.class);
		verify(admin, never()).deleteQueue(any());
		verify(admin, never()).deleteExchange(any());
		verify(admin, never()).removeBinding(any());
	}

	@Test
	void eliminarColaInexistenteOConMensajes() {
		when(admin.getQueueInfo("q.nada")).thenReturn(null);
		assertThatThrownBy(() -> service.deleteQueue("q.nada", true)).isInstanceOf(ResourceNotFoundException.class);

		when(admin.getQueueInfo("q.llena")).thenReturn(new QueueInformation("q.llena", 5, 0));
		assertThatThrownBy(() -> service.deleteQueue("q.llena", true)).isInstanceOf(ResourceConflictException.class);

		service.deleteQueue("q.llena", false);
		verify(admin).deleteQueue("q.llena");
	}

	@Test
	void creaYEliminaExchange() {
		when(management.exchange("x.sms")).thenReturn(Optional.empty());
		service.createExchange(new ExchangeRequest("x.sms", "fanout", null));
		ArgumentCaptor<Exchange> captor = ArgumentCaptor.forClass(Exchange.class);
		verify(admin).declareExchange(captor.capture());
		assertThat(captor.getValue().getType()).isEqualTo("fanout");

		exchangeExists("x.sms", "fanout");
		assertThatThrownBy(() -> service.createExchange(new ExchangeRequest("x.sms", "fanout", null)))
				.isInstanceOf(ResourceConflictException.class);
		service.deleteExchange("x.sms");
		verify(admin).deleteExchange("x.sms");
	}

	@Test
	void validaRoutingKeySegunTipoDeExchange() {
		when(admin.getQueueInfo("q.sms")).thenReturn(new QueueInformation("q.sms", 0, 0));
		when(management.bindings()).thenReturn(List.of());

		exchangeExists("cmd.direct", "direct");
		assertThatThrownBy(() -> service.createBinding(new BindingRequest("cmd.direct", "q.sms", "sms.*")))
				.isInstanceOf(InvalidRequestException.class);
		assertThatThrownBy(() -> service.createBinding(new BindingRequest("cmd.direct", "q.sms", "")))
				.isInstanceOf(InvalidRequestException.class);

		exchangeExists("cmd.topic", "topic");
		assertThatThrownBy(() -> service.createBinding(new BindingRequest("cmd.topic", "q.sms", "sms.#x")))
				.isInstanceOf(InvalidRequestException.class);
		assertThatThrownBy(() -> service.createBinding(new BindingRequest("cmd.topic", "q.sms", "sms..send")))
				.isInstanceOf(InvalidRequestException.class);
		service.createBinding(new BindingRequest("cmd.topic", "q.sms", "sms.#"));

		exchangeExists("x.fan", "fanout");
		service.createBinding(new BindingRequest("x.fan", "q.sms", "se.ignora"));

		ArgumentCaptor<Binding> captor = ArgumentCaptor.forClass(Binding.class);
		verify(admin, times(2)).declareBinding(captor.capture());
		assertThat(captor.getAllValues()).extracting(Binding::getRoutingKey).containsExactly("sms.#", "");
	}

	@Test
	void noDuplicaBindingsYExigeColaExistente() {
		exchangeExists("cmd.topic", "topic");
		when(admin.getQueueInfo("q.nada")).thenReturn(null);
		assertThatThrownBy(() -> service.createBinding(new BindingRequest("cmd.topic", "q.nada", "sms.#")))
				.isInstanceOf(ResourceNotFoundException.class);

		when(admin.getQueueInfo("q.sms")).thenReturn(new QueueInformation("q.sms", 0, 0));
		when(management.bindings()).thenReturn(List.of(Map.of("source", "cmd.topic", "destination", "q.sms",
				"destination_type", "queue", "routing_key", "sms.#")));
		assertThatThrownBy(() -> service.createBinding(new BindingRequest("cmd.topic", "q.sms", "sms.#")))
				.isInstanceOf(ResourceConflictException.class);
		verify(admin, never()).declareBinding(any());

		service.deleteBinding("cmd.topic", "q.sms", "sms.#");
		verify(admin).removeBinding(any(Binding.class));
	}
}
