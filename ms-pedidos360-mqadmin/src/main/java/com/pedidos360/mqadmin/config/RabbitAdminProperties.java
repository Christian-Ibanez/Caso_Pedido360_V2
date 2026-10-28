package com.pedidos360.mqadmin.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * Configuracion del administrador (application.yml, prefijo app.rabbit).
 *
 * @param vhost                     virtual host administrado
 * @param managementUrls            URL de la API HTTP de RabbitMQ Management (una por nodo)
 * @param protectedQueuePrefixes    colas del sistema que no se pueden eliminar desde la API
 * @param protectedExchangePrefixes exchanges del sistema (y los amq.* de RabbitMQ) que no se pueden eliminar
 */
@ConfigurationProperties(prefix = "app.rabbit")
public record RabbitAdminProperties(
		String vhost,
		List<String> managementUrls,
		List<String> protectedQueuePrefixes,
		List<String> protectedExchangePrefixes) {

	public RabbitAdminProperties {
		vhost = vhost == null || vhost.isBlank() ? "/" : vhost;
		managementUrls = managementUrls == null ? List.of() : List.copyOf(managementUrls);
		protectedQueuePrefixes = protectedQueuePrefixes == null ? List.of() : List.copyOf(protectedQueuePrefixes);
		protectedExchangePrefixes = protectedExchangePrefixes == null ? List.of() : List.copyOf(protectedExchangePrefixes);
	}

	public boolean isProtectedQueue(String name) {
		return protectedQueuePrefixes.stream().anyMatch(name::startsWith);
	}

	public boolean isProtectedExchange(String name) {
		return protectedExchangePrefixes.stream().anyMatch(name::startsWith);
	}
}
