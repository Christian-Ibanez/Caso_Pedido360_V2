package com.pedidos360.orders.messaging;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Optional;
import java.util.UUID;

/**
 * Quien / desde donde / trazas de la request actual. El BFF valida el JWT y reenvia el usuario en X-User
 * y la IP original en X-Forwarded-For; traceId y correlationId se propagan si vienen, si no se generan.
 */
public record RequestMetadata(String actor, String origin, String traceId, String correlationId) {

	public static RequestMetadata current() {
		HttpServletRequest request = Optional.ofNullable(RequestContextHolder.getRequestAttributes())
				.filter(ServletRequestAttributes.class::isInstance)
				.map(a -> ((ServletRequestAttributes) a).getRequest())
				.orElse(null);
		if (request == null) {
			String id = UUID.randomUUID().toString();
			return new RequestMetadata("system", "internal", id, id);
		}
		String traceId = header(request, "X-Trace-Id").orElse(UUID.randomUUID().toString());
		return new RequestMetadata(
				header(request, "X-User").orElse("anonymous"),
				header(request, "X-Forwarded-For").map(v -> v.split(",")[0].trim()).orElse(request.getRemoteAddr()),
				traceId,
				header(request, "X-Correlation-Id").orElse(traceId));
	}

	private static Optional<String> header(HttpServletRequest request, String name) {
		return Optional.ofNullable(request.getHeader(name)).filter(v -> !v.isBlank());
	}
}
