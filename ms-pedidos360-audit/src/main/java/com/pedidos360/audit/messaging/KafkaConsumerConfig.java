package com.pedidos360.audit.messaging;

import org.apache.kafka.common.TopicPartition;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

/**
 * Reintenta 3 veces (1 s) y si sigue fallando manda el mensaje a orders.events.audit.DLT (DLT propio de este consumidor)
 * con el mensaje original + headers de error (excepcion, stacktrace, topico/particion/offset original, timestamp).
 */
@Configuration
public class KafkaConsumerConfig {

	@Bean
	DefaultErrorHandler kafkaErrorHandler(KafkaTemplate<String, String> template,
			@Value("${app.kafka.topics.dlt}") String dltTopic) {
		DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(template,
				(record, ex) -> new TopicPartition(dltTopic, -1));
		return new DefaultErrorHandler(recoverer, new FixedBackOff(1_000L, 3));
	}
}
