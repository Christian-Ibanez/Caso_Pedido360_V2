package com.pedidos360.notify;

import com.pedidos360.notify.email.EmailConsumer;
import com.pedidos360.notify.kitchen.KitchenConsumer;
import com.pedidos360.notify.messaging.DeadLetterConsumer;
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

/**
 * Rutas de confirmacion: ACK si se procesa (y sin reprocesar si es duplicado), reintentos ante errores recuperables
 * y NACK sin requeue (-> DLQ) ante errores no recuperables o cuando se agotan los reintentos.
 */
@SpringBootTest(properties = {
		"spring.rabbitmq.listener.simple.auto-startup=false",
		"app.messaging.retry.max-attempts=3",
		"app.messaging.retry.initial-backoff-ms=1" })
class CommandConsumerTest {

	@Autowired
	EmailConsumer emailConsumer;

	@Autowired
	KitchenConsumer kitchenConsumer;

	@Autowired
	DeadLetterConsumer deadLetterConsumer;

	@Autowired
	MeterRegistry meterRegistry;

	@Test
	void emailOkHaceAckYDuplicadoNoSeReprocesa() throws Exception {
		Channel channel = mock(Channel.class);
		emailConsumer.onEmail(message(1, "evt-1", "ana@mail.com"), channel);
		verify(channel).basicAck(1, false);

		emailConsumer.onEmail(message(2, "evt-1", "ana@mail.com"), channel);
		verify(channel).basicAck(2, false);
		verify(channel, never()).basicNack(anyLong(), anyBoolean(), anyBoolean());
	}

	@Test
	void errorNoRecuperableHaceNackSinRequeueParaIrALaDlq() throws Exception {
		Channel channel = mock(Channel.class);
		emailConsumer.onEmail(message(7, "evt-2", "cliente@fail.test"), channel);
		verify(channel).basicNack(7, false, false);

		kitchenConsumer.onKitchenTicket(raw(8, "esto no es json"), channel);
		verify(channel).basicNack(8, false, false);
		verify(channel, never()).basicAck(anyLong(), anyBoolean());
	}

	@Test
	void errorRecuperableSeReintentaYTerminaEnAck() throws Exception {
		Channel channel = mock(Channel.class);
		// @retry.test falla en los 2 primeros intentos y funciona en el tercero
		emailConsumer.onEmail(message(10, "evt-r", "cliente@retry.test"), channel);
		verify(channel).basicAck(10, false);
		verify(channel, never()).basicNack(anyLong(), anyBoolean(), anyBoolean());
	}

	@Test
	void reintentosAgotadosHacenNackHaciaLaDlq() throws Exception {
		Channel channel = mock(Channel.class);
		// @down.test nunca responde: 3 intentos y luego DLQ, nunca requeue=true
		emailConsumer.onEmail(message(11, "evt-d", "cliente@down.test"), channel);
		verify(channel).basicNack(11, false, false);
		verify(channel, never()).basicNack(anyLong(), anyBoolean(), eq(true));
		verify(channel, never()).basicAck(anyLong(), anyBoolean());
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
