package com.pedidos360.notify.config;

import org.springframework.amqp.core.*;
import com.pedidos360.notify.messaging.RetryProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.List;

/**
 * Topologia del caso: 4 flujos (email, cocina, boleta y notificaciones de la campana), cada uno con cola principal + DLQ,
 * exchanges cmd.direct (routing exacto), cmd.topic (patrones) y cmd.dead.dlx (cartas muertas).
 * Registro permanente (colas sin consumidor, que no se vacian):
 * - q.audit.history: copia de cada comando publicado (las colas de trabajo se vacian al hacer ACK).
 * - q.audit.errors: copia de cada mensaje rechazado (NACK); conserva el header x-death con la cola de origen y el
 *   motivo, aunque el DeadLetterConsumer ya haya procesado la DLQ.
 * Es la misma que carga infra/mq/definitions.json; declararla aqui es idempotente y permite levantar el micro
 * contra un RabbitMQ vacio.
 */
@Configuration
@EnableConfigurationProperties(RetryProperties.class)
public class RabbitTopology {

	public static final String CMD_DIRECT = "cmd.direct";
	public static final String CMD_TOPIC = "cmd.topic";
	public static final String CMD_DLX = "cmd.dead.dlx";

	public static final String Q_EMAIL = "q.cmd.email";
	public static final String Q_KITCHEN = "q.cmd.kitchen";
	public static final String Q_INVOICE = "q.cmd.invoice";
	/** Notificaciones de la campana (pedido nuevo -> admin, en proceso -> cliente). */
	public static final String Q_INAPP = "q.notify.inapp";
	public static final String DLQ_SUFFIX = ".dlq";
	/** Registro de todos los comandos: durable, sin consumidor y sin limite, para que ningun mensaje desaparezca. */
	public static final String Q_HISTORY = "q.audit.history";
	/** Registro de todos los mensajes que fallaron: recibe una copia de lo que llega a cmd.dead.dlx. */
	public static final String Q_ERRORS = "q.audit.errors";

	/**
	 * cola, routing key exacta (direct y DLX), patron del exchange topic.
	 * En AMQP "*" es exactamente una palabra: email.* no calza con email.send.high (ejemplo del enunciado),
	 * por eso se usa "#" (0..n palabras) para que las variantes email.send.high e invoice.gen.pdf si lleguen.
	 */
	private record Flow(String queue, String routingKey, String pattern) {
	}

	private static final List<Flow> FLOWS = List.of(
			new Flow(Q_EMAIL, "email.send", "email.#"),
			new Flow(Q_KITCHEN, "kitchen.ticket", "kitchen.#"),
			new Flow(Q_INVOICE, "invoice.gen", "invoice.#"),
			new Flow(Q_INAPP, "notify.inapp", "notify.#"));

	@Bean
	public Declarables commandTopology() {
		DirectExchange direct = new DirectExchange(CMD_DIRECT, true, false);
		TopicExchange topic = new TopicExchange(CMD_TOPIC, true, false);
		DirectExchange dlx = new DirectExchange(CMD_DLX, true, false);

		List<Declarable> declarables = new ArrayList<>(List.of(direct, topic, dlx));
		for (Flow flow : FLOWS) {
			// Al rechazar (nack sin requeue) el mensaje va a cmd.dead.dlx con la routing key "canonica" del flujo,
			// asi email.send.high tambien termina en q.cmd.email.dlq
			Queue queue = QueueBuilder.durable(flow.queue())
					.deadLetterExchange(CMD_DLX)
					.deadLetterRoutingKey(flow.routingKey())
					.build();
			Queue dlq = QueueBuilder.durable(flow.queue() + DLQ_SUFFIX).build();
			declarables.add(queue);
			declarables.add(dlq);
			declarables.add(BindingBuilder.bind(queue).to(direct).with(flow.routingKey()));
			declarables.add(BindingBuilder.bind(queue).to(topic).with(flow.pattern()));
			declarables.add(BindingBuilder.bind(dlq).to(dlx).with(flow.routingKey()));
		}

		// Copia de todo lo que publica orders: en cmd.direct por cada routing key y en cmd.topic con "#"
		Queue history = QueueBuilder.durable(Q_HISTORY).build();
		declarables.add(history);
		for (Flow flow : FLOWS) {
			declarables.add(BindingBuilder.bind(history).to(direct).with(flow.routingKey()));
		}
		declarables.add(BindingBuilder.bind(history).to(topic).with("#"));

		// Copia de todo lo que se rechaza: llega por cmd.dead.dlx junto con la DLQ de cada flujo
		Queue errors = QueueBuilder.durable(Q_ERRORS).build();
		declarables.add(errors);
		for (Flow flow : FLOWS) {
			declarables.add(BindingBuilder.bind(errors).to(dlx).with(flow.routingKey()));
		}
		return new Declarables(declarables);
	}
}
