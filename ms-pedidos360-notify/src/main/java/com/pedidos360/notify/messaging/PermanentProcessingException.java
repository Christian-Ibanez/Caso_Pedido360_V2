package com.pedidos360.notify.messaging;

/**
 * Error no recuperable (datos invalidos, destinatario rechazado): reintentar no sirve, el mensaje va directo a la DLQ.
 */
public class PermanentProcessingException extends RuntimeException {

	public PermanentProcessingException(String message) {
		super(message);
	}
}
