package com.pedidos360.audit.messaging;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pedidos360.audit.dto.AuditEventResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/**
 * Publica cada registro de auditoria en audit.timeline (key = entidad:id), el historial legible por pedido/actor.
 * El topico es compact,delete: conserva al menos el ultimo registro de cada pedido durante la retencion.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TimelinePublisher {

	private final KafkaTemplate<String, String> kafkaTemplate;
	private final ObjectMapper objectMapper;

	@Value("${app.kafka.topics.timeline}")
	private String timelineTopic;

	public void publish(AuditEventResponse entry) {
		try {
			String key = entry.entityType() + ":" + entry.entityId();
			kafkaTemplate.send(timelineTopic, key, objectMapper.writeValueAsString(entry))
					.whenComplete((r, ex) -> {
						if (ex != null) {
							log.error("No se pudo publicar en {}: {}", timelineTopic, ex.getMessage());
						}
					});
		} catch (JsonProcessingException | RuntimeException ex) {
			log.error("Error publicando en {}", timelineTopic, ex);
		}
	}
}
