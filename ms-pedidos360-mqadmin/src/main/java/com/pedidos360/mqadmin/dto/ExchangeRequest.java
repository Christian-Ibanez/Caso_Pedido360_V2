package com.pedidos360.mqadmin.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Exchange a crear. Tipos permitidos: direct, topic, fanout y headers. */
@Schema(description = "Exchange a crear")
public record ExchangeRequest(
		@NotBlank(message = "el nombre es obligatorio")
		@Size(max = ResourceNames.NAME_MAX, message = "maximo " + ResourceNames.NAME_MAX + " caracteres")
		@Pattern(regexp = ResourceNames.NAME_REGEX, message = ResourceNames.NAME_MESSAGE)
		@Schema(example = "cmd.sms") String name,
		@NotBlank(message = "el tipo es obligatorio")
		@Pattern(regexp = "^(direct|topic|fanout|headers)$", message = "debe ser direct, topic, fanout o headers")
		@Schema(example = "topic", allowableValues = { "direct", "topic", "fanout", "headers" }) String type,
		Boolean durable) {

	public boolean durableOrDefault() {
		return durable == null || durable;
	}
}
