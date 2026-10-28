package com.pedidos360.orders;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pedidos360.orders.dto.OrderResponse;
import com.pedidos360.orders.messaging.MessagingTopology;
import com.pedidos360.orders.messaging.OrderEvent;
import com.pedidos360.orders.messaging.OrderMessagingListener;
import com.pedidos360.orders.messaging.RequestMetadata;
import com.pedidos360.orders.model.OrderStatus;
import org.junit.jupiter.api.Test;
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

/** Con app.kafka.enabled=false los comandos siguen saliendo por RabbitMQ y no se toca Kafka. */
class OrderMessagingListenerTest {

	@SuppressWarnings("unchecked")
	private final KafkaTemplate<String, String> kafka = mock(KafkaTemplate.class);
	private final RabbitTemplate rabbit = mock(RabbitTemplate.class);
	private final OrderMessagingListener listener = new OrderMessagingListener(kafka, rabbit, new ObjectMapper().findAndRegisterModules());

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
	}

	@Test
	void conKafkaPublicaElEvento() {
		ReflectionTestUtils.setField(listener, "enabled", true);
		ReflectionTestUtils.setField(listener, "kafkaEnabled", true);
		when(kafka.send(anyString(), anyString(), anyString())).thenReturn(new CompletableFuture<>());

		listener.on(aceptado());

		verify(kafka).send(eq(MessagingTopology.ORDERS_EVENTS_TOPIC), eq("7"), anyString());
	}
}
