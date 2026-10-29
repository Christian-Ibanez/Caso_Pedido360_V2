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
 * Las DLQ no tienen consumidor: cada mensaje rechazado (NACK) queda guardado en la DLQ de su flujo, con el header
 * x-death (cola de origen, motivo y cantidad de rechazos), hasta que alguien lo revise o lo reprocese.
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
		return new Declarables(declarables);
	}
}
