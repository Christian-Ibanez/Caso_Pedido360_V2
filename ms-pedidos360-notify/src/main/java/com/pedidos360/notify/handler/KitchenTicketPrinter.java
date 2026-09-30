package com.pedidos360.notify.handler;

import com.pedidos360.notify.consumer.CommandEnvelope;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

/** Ticket para la cocina del local cuando el pedido se acepta (simulado: se "imprime" en el log). */
@Slf4j
@Component
public class KitchenTicketPrinter implements CommandHandler {

	@Override
	public void handle(CommandEnvelope command) {
		Map<String, Object> p = command.payload();
		if (p == null || p.get("orderId") == null || p.get("items") == null) {
			throw new IllegalArgumentException("Ticket de cocina sin pedido o sin items");
		}
		log.info("[COCINA] local={} pedido={} cliente={} items={} notas={} (eventId={})",
				p.get("storeId"), p.get("orderId"), p.get("customerName"), p.get("items"), p.get("notes"), command.eventId());
	}
}
