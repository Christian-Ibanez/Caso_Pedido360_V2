package com.pedidos360.notify.messaging;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pedidos360.notify.config.RabbitTopology;
import com.rabbitmq.client.Channel;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.dao.TransientDataAccessException;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

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
 * <p>
 * Las DLQ no tienen consumidor: el mensaje rechazado queda guardado en {@code <cola>.dlq} (con el header x-death).
 * Cada envio a la DLQ se registra aqui en el log ({@code [DLQ]}: cola, DLQ, motivo, eventId y cuerpo) y en la
 * metrica {@code pedidos360.dlq.messages{queue=<cola>.dlq}}.
 */
@Slf4j
@Component
public class CommandProcessor {

	private final ObjectMapper objectMapper;
	private final ProcessedCommands processed;
	private final RetryProperties retry;
	private final MeterRegistry meterRegistry;

	public CommandProcessor(ObjectMapper objectMapper, ProcessedCommands processed, RetryProperties retry,
			MeterRegistry meterRegistry) {
		this.objectMapper = objectMapper;
		this.processed = processed;
		this.retry = retry;
		this.meterRegistry = meterRegistry;
	}

	public void process(Message message, Channel channel, CommandHandler handler) throws IOException {
		long tag = message.getMessageProperties().getDeliveryTag();
		String queue = message.getMessageProperties().getConsumerQueue();

		CommandEnvelope command;
		try {
			command = objectMapper.readValue(message.getBody(), CommandEnvelope.class);
		} catch (JsonProcessingException ex) {
			toDeadLetter(channel, message, null, "mensaje no es un comando JSON valido (" + ex.getOriginalMessage() + ")");
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
					toDeadLetter(channel, message, command.eventId(), "error no recuperable: " + ex.getMessage());
					return;
				}
				if (attempt >= retry.maxAttempts()) {
					toDeadLetter(channel, message, command.eventId(),
							"reintentos agotados (" + attempt + " de " + retry.maxAttempts() + "): " + ex.getMessage());
					return;
				}
				long wait = retry.backoffBefore(attempt + 1);
				log.warn("Error recuperable en {} (eventId={}), intento {} de {}: '{}'. Reintento en {} ms",
						queue, command.eventId(), attempt, retry.maxAttempts(), ex.getMessage(), wait);
				if (!sleep(wait)) {
					toDeadLetter(channel, message, command.eventId(), "consumidor interrumpido durante el reintento");
					return;
				}
			}
		}
	}

	/** NACK sin requeue: RabbitMQ lo deja en la DLQ de la cola (via cmd.dead.dlx). Queda registrado en log y metrica. */
	private void toDeadLetter(Channel channel, Message message, String eventId, String reason) throws IOException {
		String queue = message.getMessageProperties().getConsumerQueue();
		String dlq = queue + RabbitTopology.DLQ_SUFFIX;
		log.error("[DLQ] cola={} -> {} motivo='{}' eventId={} tipo={} cuerpo={}", queue, dlq, reason, eventId,
				message.getMessageProperties().getType(), new String(message.getBody(), StandardCharsets.UTF_8));
		meterRegistry.counter("pedidos360.dlq.messages", "queue", dlq).increment();
		channel.basicNack(message.getMessageProperties().getDeliveryTag(), false, false);
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
