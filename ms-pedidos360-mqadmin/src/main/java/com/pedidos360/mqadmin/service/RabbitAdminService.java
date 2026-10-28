package com.pedidos360.mqadmin.service;

import com.pedidos360.mqadmin.client.RabbitManagementClient;
import com.pedidos360.mqadmin.config.RabbitAdminProperties;
import com.pedidos360.mqadmin.dto.BindingRequest;
import com.pedidos360.mqadmin.dto.BindingResponse;
import com.pedidos360.mqadmin.dto.ExchangeRequest;
import com.pedidos360.mqadmin.dto.ExchangeResponse;
import com.pedidos360.mqadmin.dto.QueueRequest;
import com.pedidos360.mqadmin.dto.QueueResponse;
import com.pedidos360.mqadmin.exception.InvalidRequestException;
import com.pedidos360.mqadmin.exception.ResourceConflictException;
import com.pedidos360.mqadmin.exception.ResourceNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.AmqpAdmin;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.Exchange;
import org.springframework.amqp.core.ExchangeBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.QueueInformation;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Administracion de RabbitMQ: toda la logica de crear, listar y eliminar colas, exchanges y bindings.
 * Los controladores solo llaman a estos metodos; aqui se usan AmqpAdmin (crear/eliminar por AMQP)
 * y la API de Management (listar), y se aplican las reglas: no duplicar, no eliminar la topologia del sistema
 * y no aceptar combinaciones invalidas.
 */
@Slf4j
@Service
public class RabbitAdminService {

	private final AmqpAdmin amqpAdmin;
	private final RabbitManagementClient management;
	private final RabbitAdminProperties properties;

	public RabbitAdminService(AmqpAdmin amqpAdmin, RabbitManagementClient management, RabbitAdminProperties properties) {
		this.amqpAdmin = amqpAdmin;
		this.management = management;
		this.properties = properties;
	}

	// ------------------------------------------------------------------ colas

	public List<QueueResponse> listQueues() {
		return management.queues().stream()
				.map(this::toQueue)
				.sorted(Comparator.comparing(QueueResponse::name))
				.toList();
	}

	public QueueResponse getQueue(String name) {
		return management.queue(name).map(this::toQueue)
				.orElseThrow(() -> new ResourceNotFoundException("La cola '" + name + "' no existe"));
	}

	public QueueResponse createQueue(QueueRequest request) {
		String name = request.name().trim();
		if (amqpAdmin.getQueueInfo(name) != null) {
			throw new ResourceConflictException("La cola '" + name + "' ya existe");
		}
		QueueBuilder builder = request.durableOrDefault() ? QueueBuilder.durable(name) : QueueBuilder.nonDurable(name);
		if (request.autoDeleteOrDefault()) {
			builder.autoDelete();
		}
		if (!isBlank(request.deadLetterExchange())) {
			requireExchange(request.deadLetterExchange(), "El exchange de dead-letter");
			builder.deadLetterExchange(request.deadLetterExchange());
			if (!isBlank(request.deadLetterRoutingKey())) {
				builder.deadLetterRoutingKey(request.deadLetterRoutingKey());
			}
		}
		if (request.messageTtlMs() != null) {
			builder.ttl(Math.toIntExact(request.messageTtlMs()));
		}
		if (request.maxLength() != null) {
			builder.maxLength(request.maxLength());
		}
		Queue queue = builder.build();
		amqpAdmin.declareQueue(queue);
		log.info("[ADMIN] cola creada: {} durable={} args={}", name, queue.isDurable(), queue.getArguments());
		return new QueueResponse(name, queue.isDurable(), queue.isAutoDelete(), 0, 0, 0, 0, queue.getArguments(),
				properties.isProtectedQueue(name));
	}

	/** @param onlyIfEmpty si es true no elimina una cola que todavia tiene mensajes (evita perderlos). */
	public void deleteQueue(String name, boolean onlyIfEmpty) {
		if (properties.isProtectedQueue(name)) {
			throw new ResourceConflictException("La cola '" + name + "' es parte de la topologia del sistema y no se puede eliminar");
		}
		QueueInformation info = amqpAdmin.getQueueInfo(name);
		if (info == null) {
			throw new ResourceNotFoundException("La cola '" + name + "' no existe");
		}
		if (onlyIfEmpty && info.getMessageCount() > 0) {
			throw new ResourceConflictException("La cola '" + name + "' tiene " + info.getMessageCount()
					+ " mensajes; vaciala o usa ifEmpty=false para eliminarla igual");
		}
		amqpAdmin.deleteQueue(name);
		log.info("[ADMIN] cola eliminada: {} (tenia {} mensajes)", name, info.getMessageCount());
	}

	// -------------------------------------------------------------- exchanges

	public List<ExchangeResponse> listExchanges() {
		return management.exchanges().stream()
				.filter(e -> !str(e, "name").isEmpty()) // el exchange por defecto ("") no se administra
				.map(this::toExchange)
				.sorted(Comparator.comparing(ExchangeResponse::name))
				.toList();
	}

	public ExchangeResponse getExchange(String name) {
		return management.exchange(name).map(this::toExchange)
				.orElseThrow(() -> new ResourceNotFoundException("El exchange '" + name + "' no existe"));
	}

	public ExchangeResponse createExchange(ExchangeRequest request) {
		String name = request.name().trim();
		if (management.exchange(name).isPresent()) {
			throw new ResourceConflictException("El exchange '" + name + "' ya existe");
		}
		Exchange exchange = new ExchangeBuilder(name, request.type()).durable(request.durableOrDefault()).build();
		amqpAdmin.declareExchange(exchange);
		log.info("[ADMIN] exchange creado: {} tipo={} durable={}", name, request.type(), exchange.isDurable());
		return new ExchangeResponse(name, request.type(), exchange.isDurable(), false, false,
				properties.isProtectedExchange(name));
	}

	public void deleteExchange(String name) {
		if (properties.isProtectedExchange(name)) {
			throw new ResourceConflictException("El exchange '" + name + "' es parte de la topologia del sistema y no se puede eliminar");
		}
		requireExchange(name, "El exchange");
		amqpAdmin.deleteExchange(name);
		log.info("[ADMIN] exchange eliminado: {}", name);
	}

	// --------------------------------------------------------------- bindings

	/** Bindings exchange -> cola, opcionalmente filtrados por exchange y/o cola. */
	public List<BindingResponse> listBindings(String exchange, String queue) {
		return management.bindings().stream()
				.filter(b -> "queue".equals(str(b, "destination_type")))
				.filter(b -> !str(b, "source").isEmpty()) // bindings implicitos del exchange por defecto
				.filter(b -> isBlank(exchange) || exchange.equals(str(b, "source")))
				.filter(b -> isBlank(queue) || queue.equals(str(b, "destination")))
				.map(b -> toBinding(str(b, "source"), str(b, "destination"), str(b, "routing_key")))
				.sorted(Comparator.comparing(BindingResponse::exchange).thenComparing(BindingResponse::queue)
						.thenComparing(BindingResponse::routingKey))
				.toList();
	}

	public BindingResponse createBinding(BindingRequest request) {
		String type = requireExchange(request.exchange(), "El exchange");
		if (amqpAdmin.getQueueInfo(request.queue()) == null) {
			throw new ResourceNotFoundException("La cola '" + request.queue() + "' no existe");
		}
		String routingKey = validRoutingKey(type, request.routingKeyOrEmpty());
		boolean exists = listBindings(request.exchange(), request.queue()).stream()
				.anyMatch(b -> b.routingKey().equals(routingKey));
		if (exists) {
			throw new ResourceConflictException("El binding " + request.exchange() + " -> " + request.queue()
					+ " con routing key '" + routingKey + "' ya existe");
		}
		amqpAdmin.declareBinding(new Binding(request.queue(), Binding.DestinationType.QUEUE, request.exchange(), routingKey, null));
		log.info("[ADMIN] binding creado: {} -[{}]-> {}", request.exchange(), routingKey, request.queue());
		return toBinding(request.exchange(), request.queue(), routingKey);
	}

	public void deleteBinding(String exchange, String queue, String routingKey) {
		String key = routingKey == null ? "" : routingKey.trim();
		if (properties.isProtectedExchange(exchange) && properties.isProtectedQueue(queue)) {
			throw new ResourceConflictException("El binding " + exchange + " -> " + queue
					+ " es parte de la topologia del sistema y no se puede eliminar");
		}
		boolean exists = listBindings(exchange, queue).stream().anyMatch(b -> b.routingKey().equals(key));
		if (!exists) {
			throw new ResourceNotFoundException("No existe el binding " + exchange + " -> " + queue + " con routing key '" + key + "'");
		}
		amqpAdmin.removeBinding(new Binding(queue, Binding.DestinationType.QUEUE, exchange, key, null));
		log.info("[ADMIN] binding eliminado: {} -[{}]-> {}", exchange, key, queue);
	}

	// ---------------------------------------------------------------- reglas

	/** Devuelve el tipo del exchange o 404 si no existe. */
	private String requireExchange(String name, String label) {
		return management.exchange(name).map(e -> str(e, "type"))
				.orElseThrow(() -> new ResourceNotFoundException(label + " '" + name + "' no existe"));
	}

	/**
	 * direct: routing key exacta, obligatoria y sin comodines. topic: palabras separadas por punto, donde '*' y '#'
	 * deben ser una palabra completa. fanout/headers: la routing key no se usa.
	 */
	static String validRoutingKey(String exchangeType, String routingKey) {
		switch (exchangeType) {
			case "fanout", "headers" -> {
				return "";
			}
			case "direct" -> {
				if (routingKey.isEmpty()) {
					throw new InvalidRequestException("Un exchange direct necesita routing key");
				}
				if (routingKey.contains("*") || routingKey.contains("#")) {
					throw new InvalidRequestException("Los comodines '*' y '#' solo funcionan en exchanges topic");
				}
				return routingKey;
			}
			case "topic" -> {
				if (routingKey.isEmpty()) {
					throw new InvalidRequestException("Un exchange topic necesita un patron, por ejemplo 'sms.#'");
				}
				for (String word : routingKey.split("\\.", -1)) {
					if (word.isEmpty()) {
						throw new InvalidRequestException("El patron '" + routingKey + "' tiene palabras vacias ('..' o punto al inicio o final)");
					}
					if ((word.contains("*") || word.contains("#")) && word.length() > 1) {
						throw new InvalidRequestException("En '" + word + "' el comodin debe ser una palabra completa (ej. 'sms.*' o 'sms.#')");
					}
				}
				return routingKey;
			}
			default -> throw new InvalidRequestException("Tipo de exchange no soportado: " + exchangeType);
		}
	}

	private QueueResponse toQueue(Map<String, Object> q) {
		String name = str(q, "name");
		@SuppressWarnings("unchecked")
		Map<String, Object> args = q.get("arguments") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
		return new QueueResponse(name, bool(q, "durable"), bool(q, "auto_delete"), num(q, "messages"),
				num(q, "messages_ready"), num(q, "messages_unacknowledged"), (int) num(q, "consumers"), args,
				properties.isProtectedQueue(name));
	}

	private ExchangeResponse toExchange(Map<String, Object> e) {
		String name = str(e, "name");
		return new ExchangeResponse(name, str(e, "type"), bool(e, "durable"), bool(e, "auto_delete"), bool(e, "internal"),
				properties.isProtectedExchange(name));
	}

	private BindingResponse toBinding(String exchange, String queue, String routingKey) {
		return new BindingResponse(exchange, queue, routingKey,
				properties.isProtectedExchange(exchange) && properties.isProtectedQueue(queue));
	}

	private static String str(Map<String, Object> map, String key) {
		Object v = map.get(key);
		return v == null ? "" : v.toString();
	}

	private static boolean bool(Map<String, Object> map, String key) {
		return Boolean.TRUE.equals(map.get(key));
	}

	private static long num(Map<String, Object> map, String key) {
		return map.get(key) instanceof Number n ? n.longValue() : 0L;
	}

	private static boolean isBlank(String value) {
		return value == null || value.isBlank();
	}
}
