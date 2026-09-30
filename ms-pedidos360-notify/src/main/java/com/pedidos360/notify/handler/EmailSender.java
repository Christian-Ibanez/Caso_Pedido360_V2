package com.pedidos360.notify.handler;

import com.pedidos360.notify.consumer.CommandEnvelope;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Envio de email/webpush al cliente con el estado del pedido (simulado: se registra en el log).
 * Para demostrar la DLQ: un correo que termina en "@fail.test" o sin destinatario falla y el mensaje va a q.cmd.email.dlq.
 */
@Slf4j
@Component
public class EmailSender implements CommandHandler {

	@Override
	public void handle(CommandEnvelope command) {
		Map<String, Object> p = command.payload();
		Object to = p == null ? null : p.get("to");
		if (to == null || to.toString().isBlank()) {
			throw new IllegalArgumentException("Comando sin destinatario (payload.to)");
		}
		if (to.toString().endsWith("@fail.test")) {
			throw new IllegalStateException("Servidor de correo rechazo el destinatario " + to);
		}
		log.info("[EMAIL/WEBPUSH] para={} pedido={} estado {} -> {} total={} (eventId={}, traceId={})",
				to, p.get("orderId"), p.get("previousStatus"), p.get("status"), p.get("total"),
				command.eventId(), command.traceId());
	}
}
