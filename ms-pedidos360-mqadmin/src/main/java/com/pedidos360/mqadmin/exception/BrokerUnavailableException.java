package com.pedidos360.mqadmin.exception;

/** HTTP 503 RabbitMQ (AMQP o Management) no responde. */
public class BrokerUnavailableException extends RuntimeException {

	public BrokerUnavailableException(String message) {
		super(message);
	}

	public BrokerUnavailableException(String message, Throwable cause) {
		super(message, cause);
	}
}
