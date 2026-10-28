package com.pedidos360.mqadmin.client;

import com.pedidos360.mqadmin.config.RabbitAdminProperties;
import com.pedidos360.mqadmin.exception.BrokerUnavailableException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.amqp.RabbitProperties;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriUtils;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Lectura de la topologia desde la API HTTP de RabbitMQ Management (AMQP no permite listar recursos).
 * Prueba cada nodo configurado hasta que uno responda. Solo lectura: crear y eliminar se hace por AMQP.
 */
@Slf4j
@Component
public class RabbitManagementClient {

	private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST = new ParameterizedTypeReference<>() {
	};
	private static final ParameterizedTypeReference<Map<String, Object>> ONE = new ParameterizedTypeReference<>() {
	};

	private final RestClient client;
	private final RabbitAdminProperties properties;
	private final String username;
	private final String password;

	public RabbitManagementClient(RestClient managementRestClient, RabbitAdminProperties properties,
			RabbitProperties rabbitProperties) {
		this.client = managementRestClient;
		this.properties = properties;
		this.username = rabbitProperties.getUsername();
		this.password = rabbitProperties.getPassword();
	}

	public List<Map<String, Object>> queues() {
		return getList("/api/queues/" + vhost());
	}

	public List<Map<String, Object>> exchanges() {
		return getList("/api/exchanges/" + vhost());
	}

	public List<Map<String, Object>> bindings() {
		return getList("/api/bindings/" + vhost());
	}

	public Optional<Map<String, Object>> queue(String name) {
		return getOne("/api/queues/" + vhost() + "/" + segment(name));
	}

	public Optional<Map<String, Object>> exchange(String name) {
		return getOne("/api/exchanges/" + vhost() + "/" + segment(name));
	}

	private List<Map<String, Object>> getList(String path) {
		List<Map<String, Object>> body = call(path, spec -> spec.retrieve().body(LIST));
		return body == null ? List.of() : body;
	}

	private Optional<Map<String, Object>> getOne(String path) {
		try {
			return Optional.ofNullable(call(path, spec -> spec.retrieve().body(ONE)));
		} catch (HttpClientErrorException.NotFound notFound) {
			return Optional.empty();
		}
	}

	private <T> T call(String path, java.util.function.Function<RestClient.RequestHeadersSpec<?>, T> request) {
		RuntimeException last = null;
		for (String base : properties.managementUrls()) {
			URI uri = URI.create(base.trim().replaceAll("/+$", "") + path);
			try {
				return request.apply(client.get().uri(uri).headers(h -> h.setBasicAuth(username, password)));
			} catch (HttpClientErrorException.NotFound notFound) {
				throw notFound;
			} catch (RestClientResponseException ex) {
				if (ex.getStatusCode().isSameCodeAs(HttpStatus.UNAUTHORIZED)) {
					throw new BrokerUnavailableException("RabbitMQ Management rechazo las credenciales", ex);
				}
				last = ex;
				log.warn("RabbitMQ Management {} respondio {}, probando el siguiente nodo", base, ex.getStatusCode());
			} catch (ResourceAccessException ex) {
				last = ex;
				log.warn("RabbitMQ Management {} no responde ({}), probando el siguiente nodo", base, ex.getMessage());
			}
		}
		throw new BrokerUnavailableException("Ningun nodo de RabbitMQ Management respondio", last);
	}

	private String vhost() {
		return segment(properties.vhost());
	}

	private static String segment(String value) {
		return UriUtils.encodePathSegment(value, StandardCharsets.UTF_8);
	}
}
