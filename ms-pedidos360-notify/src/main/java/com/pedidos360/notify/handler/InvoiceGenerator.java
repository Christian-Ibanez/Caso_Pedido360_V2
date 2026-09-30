package com.pedidos360.notify.handler;

import com.pedidos360.notify.consumer.CommandEnvelope;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

/** Generacion de boleta/factura cuando el pedido se entrega (simulado: se registra en el log). */
@Slf4j
@Component
public class InvoiceGenerator implements CommandHandler {

	@Override
	public void handle(CommandEnvelope command) {
		Map<String, Object> p = command.payload();
		if (p == null || p.get("orderId") == null || p.get("total") == null) {
			throw new IllegalArgumentException("Boleta sin pedido o sin total");
		}
		log.info("[BOLETA] pedido={} cliente={} <{}> total={} (eventId={})",
				p.get("orderId"), p.get("customerName"), p.get("customerEmail"), p.get("total"), command.eventId());
	}
}
