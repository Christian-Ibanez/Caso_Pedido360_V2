package com.pedidos360.notify.kitchen;

import com.pedidos360.notify.config.RabbitTopology;
import com.pedidos360.notify.messaging.CommandProcessor;
import com.rabbitmq.client.Channel;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.io.IOException;

/** Dominio cocina: consume q.cmd.kitchen (kitchen.ticket) cuando el pedido se confirma. */
@Component
public class KitchenConsumer {

	private final CommandProcessor processor;
	private final KitchenTicketPrinter printer;

	public KitchenConsumer(CommandProcessor processor, KitchenTicketPrinter printer) {
		this.processor = processor;
		this.printer = printer;
	}

	@RabbitListener(queues = RabbitTopology.Q_KITCHEN, ackMode = "MANUAL")
	public void onKitchenTicket(Message message, Channel channel) throws IOException {
		processor.process(message, channel, printer);
	}
}
