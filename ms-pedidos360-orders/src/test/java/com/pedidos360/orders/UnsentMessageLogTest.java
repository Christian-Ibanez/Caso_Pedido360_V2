package com.pedidos360.orders;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pedidos360.orders.messaging.Command;
import com.pedidos360.orders.messaging.unsent.UnsentMessage;
import com.pedidos360.orders.messaging.unsent.UnsentMessageLog;
import com.pedidos360.orders.messaging.unsent.UnsentMessageRepository;
import com.pedidos360.orders.messaging.unsent.UnsentStatus;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.AmqpConnectException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Los comandos que no llegan a RabbitMQ quedan registrados y se reenvian sin borrar el registro. */
class UnsentMessageLogTest {

	private final UnsentMessageRepository repository = mock(UnsentMessageRepository.class);
	private final RabbitTemplate rabbit = mock(RabbitTemplate.class);
	private final UnsentMessageLog log = new UnsentMessageLog(repository, new ObjectMapper().findAndRegisterModules(), rabbit);

	private UnsentMessage pendiente(String eventId) {
		UnsentMessage m = new UnsentMessage();
		m.setId(1L);
		m.setEventId(eventId);
		m.setMessageType("InAppNotify");
		m.setExchangeName("cmd.direct");
		m.setRoutingKey("notify.inapp");
		m.setBody("{\"type\":\"InAppNotify\"}");
		m.setStatus(UnsentStatus.PENDIENTE);
		m.setCreatedAt(LocalDateTime.now());
		return m;
	}

	@Test
	void registraElComandoQueNoSePudoEnviar() {
		when(repository.findByEventId("e-1")).thenReturn(Optional.empty());
		Command command = new Command("InAppNotify", "e-1", Instant.now(), "t", "c", Map.of("orderId", 7));

		log.recordFailure("cmd.direct", "notify.inapp", command, new AmqpConnectException(new java.net.ConnectException("refused")));

		ArgumentCaptor<UnsentMessage> saved = ArgumentCaptor.forClass(UnsentMessage.class);
		verify(repository).save(saved.capture());
		assertThat(saved.getValue().getStatus()).isEqualTo(UnsentStatus.PENDIENTE);
		assertThat(saved.getValue().getRoutingKey()).isEqualTo("notify.inapp");
		assertThat(saved.getValue().getBody()).contains("\"eventId\":\"e-1\"");
		assertThat(saved.getValue().getLastError()).contains("refused");
	}

	@Test
	void alReintentarConExitoQuedaComoEnviadoSinBorrarse() {
		ReflectionTestUtils.setField(log, "enabled", true);
		UnsentMessage m = pendiente("e-2");
		when(repository.findTop50ByStatusOrderByIdAsc(UnsentStatus.PENDIENTE)).thenReturn(List.of(m));

		log.retryPending();

		verify(rabbit).send(eq("cmd.direct"), eq("notify.inapp"), any(Message.class));
		assertThat(m.getStatus()).isEqualTo(UnsentStatus.ENVIADO);
		assertThat(m.getAttempts()).isEqualTo(1);
		assertThat(m.getSentAt()).isNotNull();
		verify(repository, never()).delete(any());
	}

	@Test
	void siRabbitSigueCaidoQuedaPendienteConElError() {
		ReflectionTestUtils.setField(log, "enabled", true);
		UnsentMessage m = pendiente("e-3");
		when(repository.findTop50ByStatusOrderByIdAsc(UnsentStatus.PENDIENTE)).thenReturn(List.of(m));
		doThrow(new AmqpConnectException(new java.net.ConnectException("refused")))
				.when(rabbit).send(anyString(), anyString(), any(Message.class));

		log.retryPending();

		assertThat(m.getStatus()).isEqualTo(UnsentStatus.PENDIENTE);
		assertThat(m.getAttempts()).isEqualTo(1);
		assertThat(m.getLastError()).contains("refused");
	}
}
