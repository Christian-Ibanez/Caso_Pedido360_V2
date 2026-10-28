package com.pedidos360.mqadmin.exception;

/** HTTP 409 el recurso ya existe, esta protegido o no se puede eliminar en su estado actual. */
public class ResourceConflictException extends RuntimeException {

	public ResourceConflictException(String message) {
		super(message);
	}

	public ResourceConflictException(String message, Throwable cause) {
		super(message, cause);
	}
}
