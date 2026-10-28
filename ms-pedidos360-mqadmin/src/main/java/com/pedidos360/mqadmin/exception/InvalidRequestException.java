package com.pedidos360.mqadmin.exception;

/** HTTP 400 la combinacion de parametros no es valida para RabbitMQ. */
public class InvalidRequestException extends RuntimeException {

	public InvalidRequestException(String message) {
		super(message);
	}

	public InvalidRequestException(String message, Throwable cause) {
		super(message, cause);
	}
}
