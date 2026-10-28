package com.pedidos360.mqadmin.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Binding de un exchange a una cola. En exchanges fanout la routing key se ignora; en direct no se permiten
 * comodines; en topic '*' es una palabra y '#' cero o mas.
 */
@Schema(description = "Binding exchange -> cola")
public record BindingRequest(
		@NotBlank(message = "el exchange es obligatorio")
		@Pattern(regexp = ResourceNames.NAME_REGEX, message = ResourceNames.NAME_MESSAGE)
		@Schema(example = "cmd.topic") String exchange,
		@NotBlank(message = "la cola es obligatoria")
		@Pattern(regexp = ResourceNames.NAME_REGEX, message = ResourceNames.NAME_MESSAGE)
		@Schema(example = "q.cmd.sms") String queue,
		@Size(max = ResourceNames.ROUTING_KEY_MAX, message = "maximo " + ResourceNames.ROUTING_KEY_MAX + " caracteres")
		@Pattern(regexp = ResourceNames.ROUTING_KEY_REGEX, message = ResourceNames.ROUTING_KEY_MESSAGE)
		@Schema(example = "sms.#") String routingKey) {

	public String routingKeyOrEmpty() {
		return routingKey == null ? "" : routingKey.trim();
	}
}
