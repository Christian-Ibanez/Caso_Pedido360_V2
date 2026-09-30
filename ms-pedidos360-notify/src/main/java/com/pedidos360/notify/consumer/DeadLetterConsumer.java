package com.pedidos360.notify.consumer;

import com.pedidos360.notify.config.RabbitTopology;
import com.rabbitmq.client.Channel;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * Registra (log + metrica) los mensajes que llegaron a las DLQ: cola original, motivo, cantidad de rechazos y cuerpo.
 * Metrica: /actuator/metrics/pedidos360.dlq.messages?tag=queue:q.cmd.email.dlq, para alertar
 * por tasa de DLQ por cola.
 */
@Slf4j
@Component
public class DeadLetterConsumer {

	private final MeterRegistry meterRegistry;

	public DeadLetterConsumer(MeterRegistry meterRegistry) {
		this.meterRegistry = meterRegistry;
	}

	@RabbitListener(queues = {
			RabbitTopology.Q_EMAIL + RabbitTopology.DLQ_SUFFIX,
			RabbitTopology.Q_KITCHEN + RabbitTopology.DLQ_SUFFIX,
			RabbitTopology.Q_INVOICE + RabbitTopology.DLQ_SUFFIX }, ackMode = "MANUAL")
	public void onDeadLetter(Message message, Channel channel) throws IOException {
		MessageProperties props = message.getMessageProperties();
		String dlq = props.getConsumerQueue();
		Map<String, Object> death = firstDeath(props);
		log.error("[DLQ] cola={} origen={} motivo={} rechazos={} messageId={} tipo={} cuerpo={}",
				dlq,
				death.get("queue"),
				death.get("reason"),
				death.get("count"),
				props.getMessageId(),
				props.getType(),
				new String(message.getBody(), StandardCharsets.UTF_8));
		meterRegistry.counter("pedidos360.dlq.messages", "queue", String.valueOf(dlq)).increment();
		// Queda registrado; se hace ACK para no reprocesarlo en bucle
		channel.basicAck(props.getDeliveryTag(), false);
	}

	@SuppressWarnings("unchecked")
	private Map<String, Object> firstDeath(MessageProperties props) {
		Object xDeath = props.getHeaders().get("x-death");
		if (xDeath instanceof List<?> list && !list.isEmpty() && list.get(0) instanceof Map<?, ?> map) {
			return (Map<String, Object>) map;
		}
		return Map.of();
	}
}
