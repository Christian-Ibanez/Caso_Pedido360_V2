package com.pedidos360.orders.messaging;

import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Valida el destinatario del correo ANTES de publicar el comando. Un correo que no se puede enviar es un error de datos
 * (no se arregla reintentando), asi que no tiene sentido mandarlo a q.cmd.email: va directo a q.cmd.email.dlq.
 * <ul>
 *   <li>vacio o sin formato de correo;</li>
 *   <li>dominio {@code @fail.test}: simula un destinatario que el servidor de correo rechaza (para la demo).</li>
 * </ul>
 */
public final class EmailRecipientCheck {

	private static final Pattern FORMAT = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

	/** Dominios que simulan un rechazo del servidor de correo. */
	static final String REJECTED_DOMAIN = "@fail.test";

	private EmailRecipientCheck() {
	}

	/** Motivo por el que el correo no se puede enviar, o vacio si es valido. */
	public static Optional<String> rejectionReason(String to) {
		if (to == null || to.isBlank()) {
			return Optional.of("el pedido no tiene correo de destino");
		}
		String address = to.trim().toLowerCase(Locale.ROOT);
		if (!FORMAT.matcher(address).matches()) {
			return Optional.of("correo con formato invalido: " + to);
		}
		if (address.endsWith(REJECTED_DOMAIN)) {
			return Optional.of("destinatario rechazado por el servidor de correo: " + to);
		}
		return Optional.empty();
	}
}
