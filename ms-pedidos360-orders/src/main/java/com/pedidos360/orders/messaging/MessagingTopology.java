package com.pedidos360.orders.messaging;

/** Nombres de la topologia (deben coincidir con infra/mq/definitions.json e infra/kafka). */
public final class MessagingTopology {

	private MessagingTopology() {
	}

	public static final String ORDERS_EVENTS_TOPIC = "orders.events";

	public static final String CMD_DIRECT = "cmd.direct";
	public static final String CMD_TOPIC = "cmd.topic";

	public static final String RK_EMAIL = "email.send";
	/** Via cmd.topic (patron email.#): correos prioritarios, p. ej. cancelaciones. */
	public static final String RK_EMAIL_HIGH = "email.send.high";
	public static final String RK_KITCHEN = "kitchen.ticket";
	/** Via cmd.topic (patron invoice.#): boleta en PDF al entregar. */
	public static final String RK_INVOICE_PDF = "invoice.gen.pdf";
}
