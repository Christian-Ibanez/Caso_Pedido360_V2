package com.pedidos360.mqadmin.dto;

/** Reglas de nombres compartidas por los DTO (validacion con @Pattern). */
public final class ResourceNames {

	private ResourceNames() {
	}

	/**
	 * Letras, numeros, punto, guion y guion bajo; empieza con letra o numero; no puede empezar con "amq."
	 * (prefijo reservado por RabbitMQ).
	 */
	public static final String NAME_REGEX = "^(?!amq\\.)[A-Za-z0-9][A-Za-z0-9._-]*$";
	public static final String NAME_MESSAGE =
			"solo letras, numeros, '.', '-' y '_', debe empezar con letra o numero y no puede empezar con 'amq.'";
	public static final int NAME_MAX = 200;

	/** Routing key: palabras separadas por punto; '*' y '#' solo como comodines de exchanges topic. */
	public static final String ROUTING_KEY_REGEX = "^[A-Za-z0-9._*#-]*$";
	public static final String ROUTING_KEY_MESSAGE = "solo letras, numeros, '.', '-', '_' y los comodines '*' y '#'";
	public static final int ROUTING_KEY_MAX = 255;
}
