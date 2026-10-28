package com.pedidos360.notify.messaging;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Reintentos de los consumidores ante errores recuperables (application.yml, app.messaging.retry).
 *
 * @param maxAttempts      intentos totales antes de enviar el mensaje a la DLQ (incluye el primero)
 * @param initialBackoffMs espera antes del primer reintento; se multiplica por {@code multiplier} en cada uno
 * @param multiplier       factor de crecimiento de la espera (backoff exponencial)
 */
@ConfigurationProperties(prefix = "app.messaging.retry")
public record RetryProperties(int maxAttempts, long initialBackoffMs, double multiplier) {

	public RetryProperties {
		if (maxAttempts < 1) {
			maxAttempts = 3;
		}
		if (initialBackoffMs < 0) {
			initialBackoffMs = 500;
		}
		if (multiplier < 1) {
			multiplier = 2;
		}
	}

	public long backoffBefore(int attempt) {
		return (long) (initialBackoffMs * Math.pow(multiplier, Math.max(0, attempt - 2)));
	}
}
