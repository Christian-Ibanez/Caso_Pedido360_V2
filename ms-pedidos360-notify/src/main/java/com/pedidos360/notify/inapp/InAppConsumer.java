package com.pedidos360.notify.inapp;

import com.pedidos360.notify.config.RabbitTopology;
import com.pedidos360.notify.messaging.CommandProcessor;
import com.rabbitmq.client.Channel;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.io.IOException;

/** Dominio campana: consume q.notify.inapp y guarda el aviso que el frontend muestra al admin o al cliente. */
@Component
public class InAppConsumer {

	private final CommandProcessor processor;
	private final InAppNotifier notifier;

	public InAppConsumer(CommandProcessor processor, InAppNotifier notifier) {
		this.processor = processor;
		this.notifier = notifier;
	}

	@RabbitListener(queues = RabbitTopology.Q_INAPP, ackMode = "MANUAL")
	public void onInApp(Message message, Channel channel) throws IOException {
		processor.process(message, channel, notifier);
	}
}
