package com.pedidos360.mqadmin.exception;

/** HTTP 404 el recurso (cola, exchange o binding) no existe. */
public class ResourceNotFoundException extends RuntimeException {

	public ResourceNotFoundException(String message) {
		super(message);
	}

	public ResourceNotFoundException(String message, Throwable cause) {
		super(message, cause);
	}
}
