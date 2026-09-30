package com.pedidos360.notify.handler;

import com.pedidos360.notify.consumer.CommandEnvelope;

public interface CommandHandler {

	/** Lanza excepcion si el comando no se puede procesar: el consumidor hace NACK y el mensaje va a la DLQ. */
	void handle(CommandEnvelope command);
}
