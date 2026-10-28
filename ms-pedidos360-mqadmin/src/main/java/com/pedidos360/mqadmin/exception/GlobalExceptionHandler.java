package com.pedidos360.mqadmin.exception;

import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.AmqpConnectException;
import org.springframework.amqp.AmqpIOException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/** Traduce los errores a respuestas claras (RFC 7807 ProblemDetail) con el detalle por campo. */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(ResourceNotFoundException.class)
	public ProblemDetail notFound(ResourceNotFoundException ex) {
		return problem(HttpStatus.NOT_FOUND, "No encontrado", ex.getMessage());
	}

	@ExceptionHandler(ResourceConflictException.class)
	public ProblemDetail conflict(ResourceConflictException ex) {
		return problem(HttpStatus.CONFLICT, "Conflicto", ex.getMessage());
	}

	@ExceptionHandler(InvalidRequestException.class)
	public ProblemDetail invalid(InvalidRequestException ex) {
		return problem(HttpStatus.BAD_REQUEST, "Solicitud invalida", ex.getMessage());
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ProblemDetail validation(MethodArgumentNotValidException ex) {
		Map<String, String> fields = new LinkedHashMap<>();
		ex.getBindingResult().getFieldErrors().forEach(e -> fields.putIfAbsent(e.getField(), e.getDefaultMessage()));
		ex.getBindingResult().getGlobalErrors().forEach(e -> fields.putIfAbsent(e.getObjectName(), e.getDefaultMessage()));
		ProblemDetail pd = problem(HttpStatus.BAD_REQUEST, "Datos invalidos", fields.entrySet().stream()
				.map(e -> e.getKey() + ": " + e.getValue()).collect(Collectors.joining("; ")));
		pd.setProperty("fields", fields);
		return pd;
	}

	@ExceptionHandler({ HandlerMethodValidationException.class, ConstraintViolationException.class,
			MissingServletRequestParameterException.class })
	public ProblemDetail parameters(Exception ex) {
		String detail = ex instanceof HandlerMethodValidationException hmv
				? hmv.getAllErrors().stream().map(e -> e.getDefaultMessage()).collect(Collectors.joining("; "))
				: ex.getMessage();
		return problem(HttpStatus.BAD_REQUEST, "Parametros invalidos", detail);
	}

	@ExceptionHandler(HttpMessageNotReadableException.class)
	public ProblemDetail unreadable(HttpMessageNotReadableException ex) {
		return problem(HttpStatus.BAD_REQUEST, "JSON invalido", "El cuerpo no es un JSON valido o tiene tipos incorrectos");
	}

	/** RabbitMQ rechazo la operacion (p. ej. PRECONDITION_FAILED: ya existe con otros argumentos). */
	@ExceptionHandler(AmqpIOException.class)
	public ProblemDetail amqpRejected(AmqpIOException ex) {
		log.warn("RabbitMQ rechazo la operacion: {}", rootMessage(ex));
		return problem(HttpStatus.CONFLICT, "RabbitMQ rechazo la operacion", rootMessage(ex));
	}

	@ExceptionHandler({ AmqpConnectException.class, BrokerUnavailableException.class })
	public ProblemDetail unavailable(RuntimeException ex) {
		log.error("RabbitMQ no disponible: {}", rootMessage(ex));
		return problem(HttpStatus.SERVICE_UNAVAILABLE, "RabbitMQ no disponible",
				"No se pudo conectar con RabbitMQ, intenta de nuevo en unos segundos");
	}

	private static ProblemDetail problem(HttpStatus status, String title, String detail) {
		ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detail);
		pd.setTitle(title);
		return pd;
	}

	private static String rootMessage(Throwable ex) {
		Throwable root = ex;
		while (root.getCause() != null && root.getCause() != root) {
			root = root.getCause();
		}
		return root.getMessage() != null ? root.getMessage() : ex.getMessage();
	}
}
