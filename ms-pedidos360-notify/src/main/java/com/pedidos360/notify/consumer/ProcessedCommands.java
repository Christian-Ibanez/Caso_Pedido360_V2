package com.pedidos360.notify.consumer;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Idempotencia: recuerda los ultimos eventId procesados (el servicio no tiene DB, por eso en memoria).
 * Si RabbitMQ reentrega un comando ya procesado se hace ACK sin volver a enviar el correo.
 */
@Component
public class ProcessedCommands {

	private final Set<String> ids;

	public ProcessedCommands(@Value("${app.idempotency.cache-size:10000}") int maxSize) {
		this.ids = Collections.synchronizedSet(Collections.newSetFromMap(new LinkedHashMap<>(16, 0.75f, false) {
			@Override
			protected boolean removeEldestEntry(Map.Entry<String, Boolean> eldest) {
				return size() > maxSize;
			}
		}));
	}

	public boolean alreadyProcessed(String eventId) {
		return eventId != null && ids.contains(eventId);
	}

	public void markProcessed(String eventId) {
		if (eventId != null) {
			ids.add(eventId);
		}
	}
}
