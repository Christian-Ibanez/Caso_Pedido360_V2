package com.pedidos360.bff.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.net.URI;
import java.util.Map;
import java.util.Optional;

/**
 * Reenvia a cada microservicio las llamadas que ya pasaron la validacion del JWT y las reglas de rol (SecurityConfig).
 * No duplica reglas de negocio: devuelve tal cual el estado y el cuerpo del micro (incluidos 400/404/409).
 * Agrega X-User (quien) y X-Forwarded-For (desde donde) para la auditoria.
 */
@RestController
public class ServicesProxyController {

	private final RestClient client;
	private final Map<String, String> targets;

	public ServicesProxyController(RestClient servicesClient,
			@Value("${app.services.orders-url}") String ordersUrl,
			@Value("${app.services.catalog-url}") String catalogUrl,
			@Value("${app.services.report-url}") String reportUrl,
			@Value("${app.services.audit-url}") String auditUrl) {
		this.client = servicesClient;
		this.targets = Map.of(
				"orders", ordersUrl,
				"catalog", catalogUrl,
				"report", reportUrl,
				"audit", auditUrl);
	}

	@RequestMapping(
			path = { "/api/orders", "/api/orders/**", "/api/catalog/**", "/api/report/**", "/api/audit/**" },
			method = { RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE })
	public ResponseEntity<byte[]> proxy(HttpServletRequest request, @RequestBody(required = false) byte[] body,
			@AuthenticationPrincipal Jwt jwt) throws IOException {

		String path = request.getRequestURI();
		String service = path.split("/")[2];
		URI target = URI.create(targets.get(service) + path
				+ (request.getQueryString() != null ? "?" + request.getQueryString() : ""));

		RestClient.RequestBodySpec spec = client
				.method(HttpMethod.valueOf(request.getMethod()))
				.uri(target);

		// Reenviar la cabecera de autorizacion al microservicio
		String authHeader = request.getHeader("Authorization");
		if (authHeader != null) {
			spec.header("Authorization", authHeader);
		}
		if (jwt != null) {
			spec.header("X-User", Optional.ofNullable(jwt.getClaimAsString("preferred_username"))
					.or(() -> Optional.ofNullable(jwt.getClaimAsString("email")))
					.orElse(jwt.getSubject()));
		}
		spec.header("X-Forwarded-For", Optional.ofNullable(request.getHeader("X-Forwarded-For"))
				.map(xff -> xff + ", " + request.getRemoteAddr())
				.orElse(request.getRemoteAddr()));
		Optional.ofNullable(request.getHeader("X-Correlation-Id")).ifPresent(v -> spec.header("X-Correlation-Id", v));
		Optional.ofNullable(request.getContentType())
				.ifPresent(contentType -> spec.contentType(MediaType.parseMediaType(contentType)));

		if (body != null && body.length > 0) {
			spec.body(body);
		}

		return spec.exchange((req, res) -> {
			HttpHeaders headers = new HttpHeaders();
			Optional.ofNullable(res.getHeaders().getContentType()).ifPresent(headers::setContentType);
			return ResponseEntity.status(res.getStatusCode())
					.headers(headers)
					.body(res.getBody().readAllBytes());
		}, false);
	}
}
