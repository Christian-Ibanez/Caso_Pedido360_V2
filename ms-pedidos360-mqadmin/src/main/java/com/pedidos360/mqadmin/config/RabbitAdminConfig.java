package com.pedidos360.mqadmin.config;

import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

/**
 * Configuracion de RabbitMQ del administrador, aislada de los controladores y del servicio:
 * el RabbitAdmin (AMQP) que crea y elimina recursos y el cliente HTTP de la API de Management que los lista.
 */
@Configuration
@EnableConfigurationProperties(RabbitAdminProperties.class)
public class RabbitAdminConfig {

	/**
	 * RabbitAdmin explicito: este micro no declara topologia propia al partir (no hay beans Queue/Exchange),
	 * solo ejecuta lo que pide la API.
	 */
	@Bean
	RabbitAdmin rabbitAdmin(ConnectionFactory connectionFactory) {
		RabbitAdmin admin = new RabbitAdmin(connectionFactory);
		admin.setAutoStartup(false);
		return admin;
	}

	@Bean
	RestClient managementRestClient(RabbitAdminProperties properties) {
		SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
		factory.setConnectTimeout(Duration.ofSeconds(3));
		factory.setReadTimeout(Duration.ofSeconds(5));
		return RestClient.builder().requestFactory(factory).build();
	}
}
