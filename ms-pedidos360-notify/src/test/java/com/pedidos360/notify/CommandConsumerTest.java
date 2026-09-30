package com.pedidos360.notify;

import com.pedidos360.notify.consumer.CommandConsumer;
import com.pedidos360.notify.consumer.DeadLetterConsumer;
import com.rabbitmq.client.Channel;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/** ACK si se procesa, ACK sin reprocesar si es duplicado, NACK sin requeue (-> DLQ) si falla. */
@SpringBootTest(properties = "spring.rabbitmq.listener.simple.auto-startup=false")
class CommandConsumerTest {

	@Autowired
	CommandConsumer consumer;

	@Autowired
	DeadLetterConsumer deadLetterConsumer;

	@Autowired
	MeterRegistry meterRegistry;

	@Test
	void emailOkHaceAckYDuplicadoNoSeReprocesa() throws Exception {
		Channel channel = mock(Channel.class);
		consumer.onEmail(message(1, "evt-1", "ana@mail.com"), channel);
		verify(channel).basicAck(1, false);

		consumer.onEmail(message(2, "evt-1", "ana@mail.com"), channel);
		verify(channel).basicAck(2, false);
		verify(channel, never()).basicNack(anyLong(), anyBoolean(), anyBoolean());
	}

	@Test
	void fallaHaceNackSinRequeueParaIrALaDlq() throws Exception {
		Channel channel = mock(Channel.class);
		consumer.onEmail(message(7, "evt-2", "cliente@fail.test"), channel);
		verify(channel).basicNack(7, false, false);

		consumer.onKitchen(raw(8, "esto no es json"), channel);
		verify(channel).basicNack(8, false, false);
	}

	@Test
	void dlqSeRegistraYSeCuenta() throws Exception {
		Channel channel = mock(Channel.class);
		Message dead = message(9, "evt-3", "cliente@fail.test");
		dead.getMessageProperties().setConsumerQueue("q.cmd.email.dlq");
		dead.getMessageProperties().setHeader("x-death",
				List.of(Map.of("queue", "q.cmd.email", "reason", "rejected", "count", 1L)));
		deadLetterConsumer.onDeadLetter(dead, channel);

		verify(channel).basicAck(9, false);
		assertThat(meterRegistry.counter("pedidos360.dlq.messages", "queue", "q.cmd.email.dlq").count()).isEqualTo(1.0);
	}

	private static Message message(long tag, String eventId, String to) {
		return raw(tag, """
				{"type":"EmailSend","eventId":"%s","timestamp":"2026-09-30T12:00:00Z","traceId":"t","correlationId":"c",
				 "payload":{"orderId":1,"to":"%s","status":"ACEPTADO","previousStatus":"CREADO","total":5500}}
				""".formatted(eventId, to));
	}

	private static Message raw(long tag, String body) {
		MessageProperties props = new MessageProperties();
		props.setDeliveryTag(tag);
		props.setConsumerQueue("q.cmd.email");
		return new Message(body.getBytes(StandardCharsets.UTF_8), props);
	}
}
