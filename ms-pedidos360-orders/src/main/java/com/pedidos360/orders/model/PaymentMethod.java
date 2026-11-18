package com.pedidos360.orders.model;

/** Medio con que el cliente paga el pedido (pago simulado: no se reciben datos de tarjeta). */
public enum PaymentMethod {
	TARJETA_CREDITO("Tarjeta de crédito"),
	TARJETA_DEBITO("Tarjeta de débito"),
	TRANSFERENCIA("Transferencia"),
	EFECTIVO("Efectivo");

	private final String label;

	PaymentMethod(String label) {
		this.label = label;
	}

	public String label() {
		return label;
	}
}
