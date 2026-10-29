package com.pedidos360.orders.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.boot.autoconfigure.amqp.RabbitTemplateCustomizer;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import lombok.extern.slf4j.Slf4j;
import com.pedidos360.orders.messaging.unsent.UnsentMessageLog;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Slf4j
@Configuration
@EnableAsync
@EnableScheduling
public class MessagingConfig {

	// ---- Nombres de la mensajeria, centralizados aqui (deben coincidir con infra/mq/definitions.json) ----

	/** Topico Kafka de eventos de pedidos (solo si app.kafka.enabled=true). */
	public static final String ORDERS_EVENTS_TOPIC = "orders.events";

	/** Exchange de comandos con routing exacto. */
	public static final String CMD_DIRECT = "cmd.direct";
	/** Exchange de comandos por patron (email.#, kitchen.#, invoice.#, notify.#). */
	public static final String CMD_TOPIC = "cmd.topic";
	/** Exchange de cartas muertas: con la routing key de cada flujo lleva a su DLQ (email.send -> q.cmd.email.dlq). */
	public static final String CMD_DLX = "cmd.dead.dlx";
	/** Cola de correos (se informa en el header x-original-queue cuando el correo va directo a su DLQ). */
	public static final String Q_EMAIL = "q.cmd.email";

	/** Correo/webpush al cliente en cada cambio de estado (cmd.direct -> q.cmd.email). */
	public static final String RK_EMAIL = "email.send";
	/** Correo prioritario, p. ej. cancelaciones (cmd.topic, patron email.# -> q.cmd.email). */
	public static final String RK_EMAIL_HIGH = "email.send.high";
	/** Ticket de cocina al confirmar el pedido (cmd.direct -> q.cmd.kitchen). */
	public static final String RK_KITCHEN = "kitchen.ticket";
	/** Boleta en PDF al entregar (cmd.topic, patron invoice.# -> q.cmd.invoice). */
	public static final String RK_INVOICE_PDF = "invoice.gen.pdf";
	/** Aviso en la campana de la app (cmd.direct -> q.notify.inapp). */
	public static final String RK_INAPP = "notify.inapp";

	/** Un solo hilo: los eventos de un pedido salen en el mismo orden en que ocurrieron. */
	@Bean(name = "messagingExecutor")
	Executor messagingExecutor() {
		ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
		executor.setCorePoolSize(1);
		executor.setMaxPoolSize(1);
		executor.setQueueCapacity(10_000);
		executor.setThreadNamePrefix("messaging-");
		executor.initialize();
		return executor;
	}

	@Bean
	MessageConverter jsonMessageConverter(ObjectMapper objectMapper) {
		// Cuerpo JSON (fechas ISO); ms-notify lo lee como JSON plano, no depende de clases de este micro
		return new Jackson2JsonMessageConverter(objectMapper);
	}

	/**
	 * Mensajes que ningun binding acepta (routing key mal escrita) no se pierden en silencio: quedan en el log
	 * y en P360_UNSENT_MESSAGES con estado SIN_RUTA.
	 */
	@Bean
	RabbitTemplateCustomizer returnsLogger(ObjectProvider<UnsentMessageLog> unsent) {
		return template -> {
			template.setMandatory(true);
			template.setReturnsCallback(r -> {
				log.error("RabbitMQ devolvio el mensaje: exchange={} routingKey={} motivo={} {}",
						r.getExchange(), r.getRoutingKey(), r.getReplyCode(), r.getReplyText());
				unsent.ifAvailable(u -> u.recordReturned(r.getMessage(), r.getExchange(), r.getRoutingKey(),
						r.getReplyCode() + " " + r.getReplyText()));
			});
		};
	}

	/** El productor declara sus exchanges (idempotente). Colas, DLQ y bindings los declara ms-notify / definitions.json. */
	@Bean
	@ConditionalOnProperty(name = "app.messaging.enabled", havingValue = "true")
	DirectExchange cmdDirect() {
		return new DirectExchange(CMD_DIRECT, true, false);
	}

	@Bean
	@ConditionalOnProperty(name = "app.messaging.enabled", havingValue = "true")
	TopicExchange cmdTopic() {
		return new TopicExchange(CMD_TOPIC, true, false);
	}

	@Bean
	@ConditionalOnProperty(name = "app.messaging.enabled", havingValue = "true")
	DirectExchange cmdDeadLetter() {
		return new DirectExchange(CMD_DLX, true, false);
	}
}
