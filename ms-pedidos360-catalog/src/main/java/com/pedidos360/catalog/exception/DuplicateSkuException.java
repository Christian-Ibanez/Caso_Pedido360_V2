package com.pedidos360.catalog.exception;

public class DuplicateSkuException extends RuntimeException {
	public DuplicateSkuException(String sku) {
		super("Ya existe un producto con SKU " + sku);
	}
}
