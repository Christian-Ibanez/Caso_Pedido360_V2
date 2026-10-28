package com.pedidos360.notify.messaging;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.dao.TransientDataAccessException;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Procesa un comando con confirmacion manual. Es la unica ruta de ACK/NACK de los consumidores:
 * <ul>
 *   <li><b>OK</b>: {@code basicAck}. Un duplicado (mismo eventId) tambien se confirma sin reprocesar.</li>
 *   <li><b>Error recuperable</b> ({@link TransientProcessingException}, errores transitorios de BD): se reintenta
 *       en el mismo consumidor con backoff exponencial hasta {@code maxAttempts}. Si un reintento funciona, ACK.</li>
 *   <li><b>Reintentos agotados</b>: {@code basicNack(requeue=false)} y RabbitMQ lo manda por cmd.dead.dlx a la DLQ.</li>
 *   <li><b>Error no recuperable</b> (JSON invalido, {@link PermanentProcessingException}, datos invalidos):
 *       NACK sin reintentar, directo a la DLQ.</li>
 * </ul>
 * Nunca se usa {@code requeue=true}: un mensaje defectuoso no puede quedar dando vueltas en la cola.
 */
@Slf4j
@Component
public class CommandProcessor {

	private final ObjectMapper objectMapper;
	private final ProcessedCommands processed;
	private final RetryProperties retry;

	public CommandProcessor(ObjectMapper objectMapper, ProcessedCommands processed, RetryProperties retry) {
		this.objectMapper = objectMapper;
		this.processed = processed;
		this.retry = retry;
	}

	public void process(Message message, Channel channel, CommandHandler handler) throws IOException {
		long tag = message.getMessageProperties().getDeliveryTag();
		String queue = message.getMessageProperties().getConsumerQueue();

		CommandEnvelope command;
		try {
			command = objectMapper.readValue(message.getBody(), CommandEnvelope.class);
		} catch (JsonProcessingException ex) {
			log.warn("NACK en {}: mensaje no es un comando JSON valido ({}) -> DLQ sin reintentar", queue, ex.getOriginalMessage());
			channel.basicNack(tag, false, false);
			return;
		}

		if (processed.alreadyProcessed(command.eventId())) {
			log.info("Comando {} ya procesado (eventId={}), ACK sin reprocesar", command.type(), command.eventId());
			channel.basicAck(tag, false);
			return;
		}

		for (int attempt = 1; ; attempt++) {
			try {
				handler.handle(command);
				processed.markProcessed(command.eventId());
				if (attempt > 1) {
					log.info("Comando {} procesado en el intento {} de {} (eventId={})",
							command.type(), attempt, retry.maxAttempts(), command.eventId());
				}
				channel.basicAck(tag, false);
				return;
			} catch (RuntimeException ex) {
				if (!isRecoverable(ex)) {
					log.warn("NACK en {} (eventId={}): error no recuperable '{}' -> DLQ sin reintentar",
							queue, command.eventId(), ex.getMessage());
					channel.basicNack(tag, false, false);
					return;
				}
				if (attempt >= retry.maxAttempts()) {
					log.warn("NACK en {} (eventId={}): reintentos agotados ({} de {}), ultimo error '{}' -> DLQ",
							queue, command.eventId(), attempt, retry.maxAttempts(), ex.getMessage());
					channel.basicNack(tag, false, false);
					return;
				}
				long wait = retry.backoffBefore(attempt + 1);
				log.warn("Error recuperable en {} (eventId={}), intento {} de {}: '{}'. Reintento en {} ms",
						queue, command.eventId(), attempt, retry.maxAttempts(), ex.getMessage(), wait);
				if (!sleep(wait)) {
					channel.basicNack(tag, false, false);
					return;
				}
			}
		}
	}

	static boolean isRecoverable(RuntimeException ex) {
		return ex instanceof TransientProcessingException || ex instanceof TransientDataAccessException;
	}

	private static boolean sleep(long ms) {
		try {
			Thread.sleep(ms);
			return true;
		} catch (InterruptedException ie) {
			Thread.currentThread().interrupt();
			return false;
		}
	}
}
