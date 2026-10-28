package com.pedidos360.notify.email;

import com.pedidos360.notify.messaging.CommandEnvelope;
import com.pedidos360.notify.messaging.CommandHandler;
import com.pedidos360.notify.messaging.PermanentProcessingException;
import com.pedidos360.notify.messaging.TransientProcessingException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Envio de email/webpush al cliente con el estado del pedido (simulado: se registra en el log).
 * Correos de prueba para demostrar el manejo de errores:
 * <ul>
 *   <li>{@code ...@fail.test} o sin destinatario: error no recuperable, va directo a q.cmd.email.dlq.</li>
 *   <li>{@code ...@retry.test}: el servidor "no responde" en los 2 primeros intentos y funciona en el tercero.</li>
 *   <li>{@code ...@down.test}: el servidor nunca responde; se agotan los reintentos y va a la DLQ.</li>
 * </ul>
 */
@Slf4j
@Component
public class EmailSender implements CommandHandler {

	/** Intentos por eventId, solo para la simulacion de @retry.test. */
	private final Map<String, Integer> attempts = new ConcurrentHashMap<>();

	@Override
	public void handle(CommandEnvelope command) {
		Map<String, Object> p = command.payload();
		Object to = p == null ? null : p.get("to");
		if (to == null || to.toString().isBlank()) {
			throw new PermanentProcessingException("Comando sin destinatario (payload.to)");
		}
		String address = to.toString();
		if (address.endsWith("@fail.test")) {
			throw new PermanentProcessingException("Servidor de correo rechazo el destinatario " + address);
		}
		if (address.endsWith("@down.test")) {
			throw new TransientProcessingException("Servidor de correo no responde (timeout)");
		}
		if (address.endsWith("@retry.test") && attempts.merge(command.eventId(), 1, Integer::sum) < 3) {
			throw new TransientProcessingException("Servidor de correo no responde (timeout)");
		}
		attempts.remove(command.eventId());
		log.info("[EMAIL/WEBPUSH] para={} pedido={} estado {} -> {} total={} (eventId={}, traceId={})",
				to, p.get("orderId"), p.get("previousStatus"), p.get("status"), p.get("total"),
				command.eventId(), command.traceId());
	}
}
