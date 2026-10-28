package com.pedidos360.notify.invoice;

import com.pedidos360.notify.config.RabbitTopology;
import com.pedidos360.notify.messaging.CommandProcessor;
import com.rabbitmq.client.Channel;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.io.IOException;

/** Dominio boletas: consume q.cmd.invoice (invoice.gen y invoice.gen.pdf) cuando el pedido se entrega. */
@Component
public class InvoiceConsumer {

	private final CommandProcessor processor;
	private final InvoiceGenerator generator;

	public InvoiceConsumer(CommandProcessor processor, InvoiceGenerator generator) {
		this.processor = processor;
		this.generator = generator;
	}

	@RabbitListener(queues = RabbitTopology.Q_INVOICE, ackMode = "MANUAL")
	public void onInvoice(Message message, Channel channel) throws IOException {
		processor.process(message, channel, generator);
	}
}
