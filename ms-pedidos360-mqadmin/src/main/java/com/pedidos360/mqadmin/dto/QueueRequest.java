package com.pedidos360.mqadmin.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * Cola a crear. Por defecto durable y sin auto delete, como las colas del caso.
 *
 * @param deadLetterExchange    exchange al que van los mensajes rechazados (opcional, debe existir)
 * @param deadLetterRoutingKey  routing key con la que se reenvian a ese exchange (requiere deadLetterExchange)
 * @param messageTtlMs          tiempo de vida de los mensajes en la cola (opcional, maximo 7 dias)
 * @param maxLength             cantidad maxima de mensajes (opcional)
 */
@Schema(description = "Cola a crear")
public record QueueRequest(
		@NotBlank(message = "el nombre es obligatorio")
		@Size(max = ResourceNames.NAME_MAX, message = "maximo " + ResourceNames.NAME_MAX + " caracteres")
		@Pattern(regexp = ResourceNames.NAME_REGEX, message = ResourceNames.NAME_MESSAGE)
		@Schema(example = "q.cmd.sms") String name,
		Boolean durable,
		Boolean autoDelete,
		@Size(max = ResourceNames.NAME_MAX)
		@Pattern(regexp = ResourceNames.NAME_REGEX, message = ResourceNames.NAME_MESSAGE)
		@Schema(example = "cmd.dead.dlx") String deadLetterExchange,
		@Size(max = ResourceNames.ROUTING_KEY_MAX)
		@Pattern(regexp = "^[A-Za-z0-9._-]*$", message = "solo letras, numeros, '.', '-' y '_' (sin comodines)")
		@Schema(example = "sms.send") String deadLetterRoutingKey,
		@PositiveOrZero(message = "no puede ser negativo")
		@Max(value = 604_800_000L, message = "maximo 7 dias (604800000 ms)") Long messageTtlMs,
		@Positive(message = "debe ser mayor que 0") Integer maxLength) {

	public boolean durableOrDefault() {
		return durable == null || durable;
	}

	public boolean autoDeleteOrDefault() {
		return autoDelete != null && autoDelete;
	}

	@AssertTrue(message = "deadLetterRoutingKey requiere deadLetterExchange")
	@Schema(hidden = true)
	public boolean isDeadLetterConsistent() {
		return isBlank(deadLetterRoutingKey) || !isBlank(deadLetterExchange);
	}

	@AssertTrue(message = "una cola durable no puede ser auto delete")
	@Schema(hidden = true)
	public boolean isDurabilityConsistent() {
		return !(durableOrDefault() && autoDeleteOrDefault());
	}

	static boolean isBlank(String value) {
		return value == null || value.isBlank();
	}
}
