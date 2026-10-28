package com.pedidos360.orders;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pedidos360.orders.dto.OrderResponse;
import com.pedidos360.orders.messaging.MessagingTopology;
import com.pedidos360.orders.messaging.OrderEvent;
import com.pedidos360.orders.messaging.OrderMessagingListener;
import com.pedidos360.orders.messaging.RequestMetadata;
import com.pedidos360.orders.messaging.Command;
import com.pedidos360.orders.messaging.unsent.UnsentMessageLog;
import org.springframework.amqp.AmqpConnectException;
import com.pedidos360.orders.model.OrderStatus;
import org.junit.jupiter.api.Test;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;
import org.springframework.amqp.core.MessagePostProcessor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.atLeastOnce;

/** Con app.kafka.enabled=false los comandos siguen saliendo por RabbitMQ y no se toca Kafka. */
class OrderMessagingListenerTest {

	@SuppressWarnings("unchecked")
	private final KafkaTemplate<String, String> kafka = mock(KafkaTemplate.class);
	private final RabbitTemplate rabbit = mock(RabbitTemplate.class);
	private final UnsentMessageLog unsent = mock(UnsentMessageLog.class);
	private final OrderMessagingListener listener = new OrderMessagingListener(kafka, rabbit, new ObjectMapper().findAndRegisterModules(), unsent);

	private OrderEvent aceptado() {
		OrderResponse order = new OrderResponse(7L, 1L, "Ana", "ana@mail.com", null, null, OrderStatus.ACEPTADO,
				new BigDecimal("3000"), List.of(), LocalDateTime.now(), LocalDateTime.now(), LocalDateTime.now(), null, null);
		return OrderEvent.of("OrderAccepted", OrderStatus.CREADO, order, new RequestMetadata("ana@mail.com", "10.0.0.7", "t", "c"));
	}

	@Test
	void sinKafkaSoloEnviaComandosARabbit() {
		ReflectionTestUtils.setField(listener, "enabled", true);
		ReflectionTestUtils.setField(listener, "kafkaEnabled", false);

		listener.on(aceptado());

		verifyNoInteractions(kafka);
		verify(rabbit).convertAndSend(eq(MessagingTopology.CMD_DIRECT), eq(MessagingTopology.RK_EMAIL), any(Object.class), any(MessagePostProcessor.class));
		verify(rabbit).convertAndSend(eq(MessagingTopology.CMD_DIRECT), eq(MessagingTopology.RK_KITCHEN), any(Object.class), any(MessagePostProcessor.class));
		verify(rabbit).convertAndSend(eq(MessagingTopology.CMD_DIRECT), eq(MessagingTopology.RK_INAPP), any(Object.class), any(MessagePostProcessor.class));
	}

	@Test
	void pedidoNuevoNotificaAlAdministradorYAlConfirmarAlCliente() {
		OrderResponse creado = new OrderResponse(8L, 1L, "Ana", "ana@mail.com", null, null, OrderStatus.CREADO,
				new BigDecimal("12500"), List.of(), LocalDateTime.now(), LocalDateTime.now(), null, null, null);
		Map<String, Object> admin = OrderMessagingListener.inAppPayload(
				OrderEvent.of(OrderEvent.CREATED, null, creado, new RequestMetadata("ana@mail.com", "10.0.0.7", "t", "c")));
		assertThat(admin).containsEntry("audience", "ADMIN").containsEntry("orderId", 8L);
		assertThat(admin.get("recipient")).isNull();
		assertThat((String) admin.get("body")).contains("$12.500");

		Map<String, Object> cliente = OrderMessagingListener.inAppPayload(aceptado());
		assertThat(cliente).containsEntry("audience", "CUSTOMER").containsEntry("recipient", "ana@mail.com");
		assertThat((String) cliente.get("title")).isEqualTo("Tu pedido #7 está en proceso");
	}

	@Test
	void conKafkaPublicaElEvento() {
		ReflectionTestUtils.setField(listener, "enabled", true);
		ReflectionTestUtils.setField(listener, "kafkaEnabled", true);
		when(kafka.send(anyString(), anyString(), anyString())).thenReturn(new CompletableFuture<>());

		listener.on(aceptado());

		verify(kafka).send(eq(MessagingTopology.ORDERS_EVENTS_TOPIC), eq("7"), anyString());
	}

	@Test
	void siRabbitEstaCaidoElComandoQuedaRegistradoParaReintento() {
		ReflectionTestUtils.setField(listener, "enabled", true);
		ReflectionTestUtils.setField(listener, "kafkaEnabled", false);
		doThrow(new AmqpConnectException(new java.net.ConnectException("Connection refused")))
				.when(rabbit).convertAndSend(anyString(), anyString(), any(Object.class), any(MessagePostProcessor.class));

		listener.on(aceptado());

		verify(unsent, atLeastOnce()).recordFailure(eq(MessagingTopology.CMD_DIRECT), eq(MessagingTopology.RK_INAPP),
				any(Command.class), any(Exception.class));
	}
}
