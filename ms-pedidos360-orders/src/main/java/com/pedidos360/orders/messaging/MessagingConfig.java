package com.pedidos360.orders.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.boot.autoconfigure.amqp.RabbitTemplateCustomizer;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Slf4j
@Configuration
@EnableAsync
public class MessagingConfig {

	/** Un solo hilo: los eventos de un pedido salen en el mismo orden en que ocurrieron. */
	@Bean(name = "messagingExecutor")
	Executor messagingExecutor() {
		ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
		executor.setCorePoolSize(1);
		executor.setMaxPoolSize(1);
		executor.setQueueCapacity(10_000);
		executor.setThreadNamePrefix("messaging-");
		executor.initialize();
		return executor;
	}

	@Bean
	MessageConverter jsonMessageConverter(ObjectMapper objectMapper) {
		// Cuerpo JSON (fechas ISO); ms-notify lo lee como JSON plano, no depende de clases de este micro
		return new Jackson2JsonMessageConverter(objectMapper);
	}

	/** Mensajes que ningun binding acepta (routing key mal escrita) quedan en el log en vez de perderse en silencio. */
	@Bean
	RabbitTemplateCustomizer returnsLogger() {
		return template -> {
			template.setMandatory(true);
			template.setReturnsCallback(r -> log.error("RabbitMQ devolvio el mensaje: exchange={} routingKey={} motivo={} {}",
					r.getExchange(), r.getRoutingKey(), r.getReplyCode(), r.getReplyText()));
		};
	}

	/** El productor declara sus exchanges (idempotente). Colas, DLQ y bindings los declara ms-notify / definitions.json. */
	@Bean
	@ConditionalOnProperty(name = "app.messaging.enabled", havingValue = "true")
	DirectExchange cmdDirect() {
		return new DirectExchange(MessagingTopology.CMD_DIRECT, true, false);
	}

	@Bean
	@ConditionalOnProperty(name = "app.messaging.enabled", havingValue = "true")
	TopicExchange cmdTopic() {
		return new TopicExchange(MessagingTopology.CMD_TOPIC, true, false);
	}
}
