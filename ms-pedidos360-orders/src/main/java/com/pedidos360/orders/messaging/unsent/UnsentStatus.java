package com.pedidos360.orders.messaging.unsent;

public enum UnsentStatus {
	/** No se pudo publicar; el reintento lo vuelve a enviar. */
	PENDIENTE,
	/** Se publico en un reintento. */
	ENVIADO,
	/** RabbitMQ lo devolvio porque ninguna cola lo acepta (routing key sin binding); no se reintenta. */
	SIN_RUTA
}
