package com.pedidos360.orders.client;

import com.pedidos360.orders.exception.CatalogUnavailableException;
import com.pedidos360.orders.exception.InvalidStatusTransitionException;
import com.pedidos360.orders.model.CustomerOrder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Map;

/**
 * Coordinacion de stock con ms-pedidos360-catalog (llamada sincrona por la red interna).
 * Con app.catalog.enabled=false (perfil local/tests) no descuenta nada.
 */
@Slf4j
@Component
public class CatalogClient {

	private final RestClient client;
	private final boolean enabled;

	public CatalogClient(RestClient.Builder builder,
			@Value("${app.catalog.url}") String catalogUrl,
			@Value("${app.catalog.enabled:false}") boolean enabled) {
		SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
		factory.setConnectTimeout(3_000);
		factory.setReadTimeout(5_000);
		this.client = builder.baseUrl(catalogUrl).requestFactory(factory).build();
		this.enabled = enabled;
	}

	/** Regla del caso: el stock decrece al aceptar. Si falta stock el pedido no se acepta (409). */
	public void decreaseStock(CustomerOrder order) {
		move("decrease", order);
	}

	/** Si se cancela un pedido que ya habia descontado stock, se repone. */
	public void increaseStock(CustomerOrder order) {
		move("increase", order);
	}

	private void move(String operation, CustomerOrder order) {
		if (!enabled) {
			log.debug("Catalogo desactivado, no se hace {} de stock del pedido {}", operation, order.getId());
			return;
		}
		List<Map<String, Object>> items = order.getItems().stream()
				.map(i -> Map.<String, Object>of("productId", i.getProductId(), "quantity", i.getQuantity()))
				.toList();
		try {
			client.post()
					.uri("/api/catalog/products/stock/{op}", operation)
					.contentType(MediaType.APPLICATION_JSON)
					.body(Map.of("orderId", order.getId(), "items", items))
					.retrieve()
					.onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
						ProblemDetail problem = null;
						try {
							problem = new com.fasterxml.jackson.databind.ObjectMapper()
									.readValue(res.getBody(), ProblemDetail.class);
						} catch (Exception ignored) {
							// sin detalle
						}
						throw new InvalidStatusTransitionException("Catalogo rechazo el movimiento de stock: "
								+ (problem != null && problem.getDetail() != null ? problem.getDetail() : res.getStatusCode()));
					})
					.toBodilessEntity();
		} catch (RestClientException ex) {
			throw new CatalogUnavailableException("No se pudo contactar a ms-pedidos360-catalog: " + ex.getMessage());
		}
	}
}
