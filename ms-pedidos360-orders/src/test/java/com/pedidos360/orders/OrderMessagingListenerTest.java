package com.pedidos360.orders;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pedidos360.orders.dto.OrderResponse;
import com.pedidos360.orders.messaging.MessagingConfig;
import com.pedidos360.orders.messaging.OrderEvent;
import com.pedidos360.orders.messaging.OrderMessagingListener;
import com.pedidos360.orders.messaging.RequestMetadata;
import com.pedidos360.orders.messaging.Command;
import com.pedidos360.orders.messaging.unsent.UnsentMessageLog;
import org.springframework.amqp.AmqpConnectException;
import com.pedidos360.orders.model.OrderStatus;
import com.pedidos360.orders.model.PaymentMethod;
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
import static org.mockito.Mockito.never;
import org.mockito.ArgumentCaptor;
import static org.mockito.Mockito.times;
import java.nio.charset.StandardCharsets;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import com.pedidos360.orders.messaging.EmailRecipientCheck;

/** Con app.kafka.enabled=false los comandos siguen saliendo por RabbitMQ y no se toca Kafka. */
class OrderMessagingListenerTest {

	@SuppressWarnings("unchecked")
	private final KafkaTemplate<String, String> kafka = mock(KafkaTemplate.class);
	private final RabbitTemplate rabbit = mock(RabbitTemplate.class);
	private final UnsentMessageLog unsent = mock(UnsentMessageLog.class);
	private final OrderMessagingListener listener = new OrderMessagingListener(kafka, rabbit, new ObjectMapper().findAndRegisterModules(), unsent);

	private OrderEvent aceptado() {
		return aceptado("ana@mail.com");
	}

	private OrderEvent aceptado(String email) {
		OrderResponse order = new OrderResponse(7L, 1L, "Ana", email, null, null, OrderStatus.ACEPTADO,
				new BigDecimal("3000"), List.of(), LocalDateTime.now(), LocalDateTime.now(), LocalDateTime.now(), null, null, null, null);
		return OrderEvent.of("OrderAccepted", OrderStatus.CREADO, order, new RequestMetadata("ana@mail.com", "10.0.0.7", "t", "c"));
	}

	private OrderEvent creado(String email) {
		OrderResponse order = new OrderResponse(9L, 1L, "Ana", email, null, null, OrderStatus.CREADO,
				new BigDecimal("3000"), List.of(), LocalDateTime.now(), LocalDateTime.now(), null, null, null, null, null);
		return OrderEvent.of(OrderEvent.CREATED, null, order, new RequestMetadata("ana@mail.com", "10.0.0.7", "t", "c"));
	}

	@Test
	void pedidoNuevoVaALaCocinaYAlCorreo() {
		ReflectionTestUtils.setField(listener, "enabled", true);
		ReflectionTestUtils.setField(listener, "kafkaEnabled", false);

		listener.on(creado("ana@mail.com"));

		verify(rabbit).convertAndSend(eq(MessagingConfig.CMD_DIRECT), eq(MessagingConfig.RK_KITCHEN), any(Object.class), any(MessagePostProcessor.class));
		verify(rabbit).convertAndSend(eq(MessagingConfig.CMD_DIRECT), eq(MessagingConfig.RK_EMAIL), any(Object.class), any(MessagePostProcessor.class));
		verify(rabbit).convertAndSend(eq(MessagingConfig.CMD_DIRECT), eq(MessagingConfig.RK_INAPP), any(Object.class), any(MessagePostProcessor.class));
	}

	private OrderEvent pagado() {
		OrderResponse order = new OrderResponse(5L, 1L, "Ana", "ana@mail.com", null, null, OrderStatus.CREADO,
				new BigDecimal("8900"), List.of(), LocalDateTime.now(), LocalDateTime.now(), null, null, null,
				PaymentMethod.TARJETA_CREDITO, LocalDateTime.now());
		return OrderEvent.of(OrderEvent.PAID, OrderStatus.CREADO, order, new RequestMetadata("ana@mail.com", "10.0.0.7", "t", "c"));
	}

	@Test
	void alPagarLaBoletaVaAInvoiceYElAdminRecibeElAviso() {
		ReflectionTestUtils.setField(listener, "enabled", true);
		ReflectionTestUtils.setField(listener, "kafkaEnabled", false);

		listener.on(pagado());

		ArgumentCaptor<Object> invoice = ArgumentCaptor.forClass(Object.class);
		verify(rabbit).convertAndSend(eq(MessagingConfig.CMD_TOPIC), eq(MessagingConfig.RK_INVOICE_PDF), invoice.capture(), any(MessagePostProcessor.class));
		Command command = (Command) invoice.getValue();
		assertThat(command.type()).isEqualTo("InvoiceGenerate");
		assertThat(command.payload()).containsEntry("orderId", 5L).containsEntry("paymentMethod", PaymentMethod.TARJETA_CREDITO);
		verify(rabbit).convertAndSend(eq(MessagingConfig.CMD_DIRECT), eq(MessagingConfig.RK_INAPP), any(Object.class), any(MessagePostProcessor.class));
		// el pago no repite el correo ni el ticket de cocina
		verify(rabbit, never()).convertAndSend(eq(MessagingConfig.CMD_DIRECT), eq(MessagingConfig.RK_EMAIL), any(Object.class), any(MessagePostProcessor.class));
		verify(rabbit, never()).convertAndSend(eq(MessagingConfig.CMD_DIRECT), eq(MessagingConfig.RK_KITCHEN), any(Object.class), any(MessagePostProcessor.class));

		Map<String, Object> aviso = OrderMessagingListener.inAppPayload(pagado());
		assertThat(aviso).containsEntry("audience", "ADMIN");
		assertThat((String) aviso.get("body")).contains("$8.900").contains("tarjeta de crédito");
	}

	@Test
	void sinKafkaSoloEnviaComandosARabbit() {
		ReflectionTestUtils.setField(listener, "enabled", true);
		ReflectionTestUtils.setField(listener, "kafkaEnabled", false);

		listener.on(aceptado());

		verifyNoInteractions(kafka);
		verify(rabbit).convertAndSend(eq(MessagingConfig.CMD_DIRECT), eq(MessagingConfig.RK_EMAIL), any(Object.class), any(MessagePostProcessor.class));
		// la cocina ya recibio el ticket al crear el pedido: aceptar no manda otro
		verify(rabbit, never()).convertAndSend(eq(MessagingConfig.CMD_DIRECT), eq(MessagingConfig.RK_KITCHEN), any(Object.class), any(MessagePostProcessor.class));
		verify(rabbit).convertAndSend(eq(MessagingConfig.CMD_DIRECT), eq(MessagingConfig.RK_INAPP), any(Object.class), any(MessagePostProcessor.class));
	}

	@Test
	void pedidoNuevoNotificaAlAdministradorYAlConfirmarAlCliente() {
		OrderResponse creado = new OrderResponse(8L, 1L, "Ana", "ana@mail.com", null, null, OrderStatus.CREADO,
				new BigDecimal("12500"), List.of(), LocalDateTime.now(), LocalDateTime.now(), null, null, null, null, null);
		Map<String, Object> admin = OrderMessagingListener.inAppPayload(
				OrderEvent.of(OrderEvent.CREATED, null, creado, new RequestMetadata("ana@mail.com", "10.0.0.7", "t", "c")));
		assertThat(admin).containsEntry("audience", "ADMIN").containsEntry("orderId", 8L);
		assertThat(admin.get("recipient")).isNull();
		assertThat((String) admin.get("body")).contains("$12.500");

		Map<String, Object> cliente = OrderMessagingListener.inAppPayload(aceptado());
		assertThat(cliente).containsEntry("audience", "CUSTOMER").containsEntry("recipient", "ana@mail.com");
		assertThat((String) cliente.get("title")).isEqualTo("Tu pedido #7 está en proceso");
	}

	@SuppressWarnings("unchecked")
	private List<ProducerRecord<String, String>> kafkaRecords(int times) {
		ArgumentCaptor<ProducerRecord<String, String>> captor = ArgumentCaptor.forClass(ProducerRecord.class);
		verify(kafka, times(times)).send(captor.capture());
		return captor.getAllValues();
	}

	@SuppressWarnings("unchecked")
	private void kafkaSendOk() {
		when(kafka.send(any(ProducerRecord.class))).thenReturn(new CompletableFuture<>());
	}

	private static String header(ProducerRecord<String, String> r, String name) {
		var h = r.headers().lastHeader(name);
		return h == null ? null : new String(h.value(), StandardCharsets.UTF_8);
	}

	@Test
	void pedidoConCorreoInvalidoVaAAuditTimelineYALasDltNoAOrdersEvents() {
		ReflectionTestUtils.setField(listener, "enabled", true);
		ReflectionTestUtils.setField(listener, "kafkaEnabled", true);
		kafkaSendOk();

		listener.on(creado("cliente@fail.test"));

		List<ProducerRecord<String, String>> records = kafkaRecords(3);
		assertThat(records).extracting(ProducerRecord::topic)
				.containsExactly(MessagingConfig.AUDIT_TIMELINE_TOPIC, "orders.events.audit.DLT", "orders.events.report.DLT")
				.doesNotContain(MessagingConfig.ORDERS_EVENTS_TOPIC);
		assertThat(records.get(0).key()).isEqualTo("ORDER:9");
		assertThat(records.get(0).value()).contains("\"type\":\"OrderEmailRejected\"");
		assertThat(header(records.get(0), "x-rejection-reason")).isNull();
		assertThat(header(records.get(1), "x-rejection-reason")).contains("fail.test");
	}

	@Test
	void pedidoRechazadoPorFaltaDePagoVaAOrdersEventsYALasDlt() {
		ReflectionTestUtils.setField(listener, "enabled", true);
		ReflectionTestUtils.setField(listener, "kafkaEnabled", true);
		kafkaSendOk();
		OrderResponse order = new OrderResponse(9L, 1L, "Ana", "ana@mail.com", null, null, OrderStatus.RECHAZADO,
				new BigDecimal("3000"), List.of(), LocalDateTime.now(), LocalDateTime.now(), null, null, null, null, null);

		listener.on(OrderEvent.of(OrderEvent.REJECTED, OrderStatus.CREADO, order, new RequestMetadata("system", "internal", "t", "c")));

		List<ProducerRecord<String, String>> records = kafkaRecords(3);
		assertThat(records).extracting(ProducerRecord::topic)
				.containsExactly(MessagingConfig.ORDERS_EVENTS_TOPIC, "orders.events.audit.DLT", "orders.events.report.DLT");
		assertThat(header(records.get(2), "x-rejection-reason")).contains("no pagó");
		// el cliente recibe el aviso en la campana
		Map<String, Object> aviso = OrderMessagingListener.inAppPayload(
				OrderEvent.of(OrderEvent.REJECTED, OrderStatus.CREADO, order, new RequestMetadata("system", "internal", "t", "c")));
		assertThat((String) aviso.get("title")).isEqualTo("Tu pedido #9 fue rechazado");
	}

	@Test
	void conKafkaPublicaElEvento() {
		ReflectionTestUtils.setField(listener, "enabled", true);
		ReflectionTestUtils.setField(listener, "kafkaEnabled", true);
		kafkaSendOk();

		listener.on(aceptado());

		List<ProducerRecord<String, String>> records = kafkaRecords(1);
		assertThat(records.get(0).topic()).isEqualTo(MessagingConfig.ORDERS_EVENTS_TOPIC);
		assertThat(records.get(0).key()).isEqualTo("7");
	}

	@Test
	void siRabbitEstaCaidoElComandoQuedaRegistradoParaReintento() {
		ReflectionTestUtils.setField(listener, "enabled", true);
		ReflectionTestUtils.setField(listener, "kafkaEnabled", false);
		doThrow(new AmqpConnectException(new java.net.ConnectException("Connection refused")))
				.when(rabbit).convertAndSend(anyString(), anyString(), any(Object.class), any(MessagePostProcessor.class));

		listener.on(aceptado());

		verify(unsent, atLeastOnce()).recordFailure(eq(MessagingConfig.CMD_DIRECT), eq(MessagingConfig.RK_INAPP),
				any(Command.class), any(Exception.class));
	}

	@Test
	void correoRechazadoVaDirectoALaDlqSinPasarPorLaColaDeCorreos() throws Exception {
		ReflectionTestUtils.setField(listener, "enabled", true);
		ReflectionTestUtils.setField(listener, "kafkaEnabled", false);

		listener.on(creado("cliente@fail.test"));

		// cmd.dead.dlx + email.send -> q.cmd.email.dlq; nunca a cmd.direct/email.send (q.cmd.email)
		ArgumentCaptor<MessagePostProcessor> post = ArgumentCaptor.forClass(MessagePostProcessor.class);
		verify(rabbit).convertAndSend(eq(MessagingConfig.CMD_DLX), eq(MessagingConfig.RK_EMAIL), any(Object.class), post.capture());
		verify(rabbit, never()).convertAndSend(eq(MessagingConfig.CMD_DIRECT), eq(MessagingConfig.RK_EMAIL), any(Object.class), any(MessagePostProcessor.class));
		// el resto del pedido sigue su camino normal
		verify(rabbit).convertAndSend(eq(MessagingConfig.CMD_DIRECT), eq(MessagingConfig.RK_KITCHEN), any(Object.class), any(MessagePostProcessor.class));

		Message msg = post.getValue().postProcessMessage(new Message(new byte[0], new MessageProperties()));
		assertThat((String) msg.getMessageProperties().getHeader("x-error-reason")).contains("cliente@fail.test");
		assertThat((String) msg.getMessageProperties().getHeader("x-original-queue")).isEqualTo("q.cmd.email");
	}

	@Test
	void validaElDestinatarioDelCorreo() {
		assertThat(EmailRecipientCheck.rejectionReason("ana@mail.com")).isEmpty();
		assertThat(EmailRecipientCheck.rejectionReason("cliente@retry.test")).isEmpty();
		assertThat(EmailRecipientCheck.rejectionReason("cliente@fail.test")).isPresent();
		assertThat(EmailRecipientCheck.rejectionReason("")).isPresent();
		assertThat(EmailRecipientCheck.rejectionReason(null)).isPresent();
		assertThat(EmailRecipientCheck.rejectionReason("sin-arroba")).isPresent();
	}
}
