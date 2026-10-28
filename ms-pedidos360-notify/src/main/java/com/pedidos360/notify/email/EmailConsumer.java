package com.pedidos360.notify.email;

import com.pedidos360.notify.config.RabbitTopology;
import com.pedidos360.notify.messaging.CommandProcessor;
import com.rabbitmq.client.Channel;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.io.IOException;

/** Dominio correo: consume q.cmd.email (email.send por cmd.direct y email.# por cmd.topic). */
@Component
public class EmailConsumer {

	private final CommandProcessor processor;
	private final EmailSender emailSender;

	public EmailConsumer(CommandProcessor processor, EmailSender emailSender) {
		this.processor = processor;
		this.emailSender = emailSender;
	}

	@RabbitListener(queues = RabbitTopology.Q_EMAIL, ackMode = "MANUAL")
	public void onEmail(Message message, Channel channel) throws IOException {
		processor.process(message, channel, emailSender);
	}
}
