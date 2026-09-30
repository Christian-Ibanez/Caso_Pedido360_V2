package com.pedidos360.notify.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pedidos360.notify.config.RabbitTopology;
import com.pedidos360.notify.handler.CommandHandler;
import com.pedidos360.notify.handler.EmailSender;
import com.pedidos360.notify.handler.InvoiceGenerator;
import com.pedidos360.notify.handler.KitchenTicketPrinter;
import com.rabbitmq.client.Channel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Consume las 3 colas de comandos con ACK/NACK explicito:
 * OK -> basicAck; error -> basicNack(requeue=false) y RabbitMQ lo manda por cmd.dead.dlx a la DLQ de la cola.
 */
@Slf4j
@Component
public class CommandConsumer {

	private final ObjectMapper objectMapper;
	private final ProcessedCommands processed;
	private final EmailSender emailSender;
	private final KitchenTicketPrinter kitchenTicketPrinter;
	private final InvoiceGenerator invoiceGenerator;

	public CommandConsumer(ObjectMapper objectMapper, ProcessedCommands processed, EmailSender emailSender,
			KitchenTicketPrinter kitchenTicketPrinter, InvoiceGenerator invoiceGenerator) {
		this.objectMapper = objectMapper;
		this.processed = processed;
		this.emailSender = emailSender;
		this.kitchenTicketPrinter = kitchenTicketPrinter;
		this.invoiceGenerator = invoiceGenerator;
	}

	@RabbitListener(queues = RabbitTopology.Q_EMAIL, ackMode = "MANUAL")
	public void onEmail(Message message, Channel channel) throws IOException {
		process(message, channel, emailSender);
	}

	@RabbitListener(queues = RabbitTopology.Q_KITCHEN, ackMode = "MANUAL")
	public void onKitchen(Message message, Channel channel) throws IOException {
		process(message, channel, kitchenTicketPrinter);
	}

	@RabbitListener(queues = RabbitTopology.Q_INVOICE, ackMode = "MANUAL")
	public void onInvoice(Message message, Channel channel) throws IOException {
		process(message, channel, invoiceGenerator);
	}

	void process(Message message, Channel channel, CommandHandler handler) throws IOException {
		long tag = message.getMessageProperties().getDeliveryTag();
		String queue = message.getMessageProperties().getConsumerQueue();
		CommandEnvelope command = null;
		try {
			command = objectMapper.readValue(message.getBody(), CommandEnvelope.class);
			if (processed.alreadyProcessed(command.eventId())) {
				log.info("Comando {} ya procesado (eventId={}), ACK sin reprocesar", command.type(), command.eventId());
				channel.basicAck(tag, false);
				return;
			}
			handler.handle(command);
			processed.markProcessed(command.eventId());
			channel.basicAck(tag, false);
		} catch (Exception ex) {
			log.warn("NACK en {} (eventId={}): {} -> se envia a la DLQ", queue,
					command != null ? command.eventId() : "?", ex.getMessage());
			channel.basicNack(tag, false, false);
		}
	}
}
