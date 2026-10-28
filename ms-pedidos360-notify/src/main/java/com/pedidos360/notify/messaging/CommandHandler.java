package com.pedidos360.notify.messaging;


public interface CommandHandler {

	/**
	 * Procesa un comando. Para fallar se lanza {@link TransientProcessingException} si vale la pena reintentar
	 * o {@link PermanentProcessingException} si no; ver {@link CommandProcessor}.
	 */
	void handle(CommandEnvelope command);
}
