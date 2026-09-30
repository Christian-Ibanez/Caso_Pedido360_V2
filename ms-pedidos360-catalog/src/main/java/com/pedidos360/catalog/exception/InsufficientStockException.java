package com.pedidos360.catalog.exception;

public class InsufficientStockException extends RuntimeException {
	public InsufficientStockException(String message) {
		super(message);
	}
}
