package com.pedidos360.notify.messaging;

/**
 * Error recuperable (p. ej. el servidor de correo no responde por un momento): el consumidor reintenta el mensaje
 * hasta app.messaging.retry.max-attempts veces antes de rendirse y enviarlo a la DLQ.
 */
public class TransientProcessingException extends RuntimeException {

	public TransientProcessingException(String message) {
		super(message);
	}
}
