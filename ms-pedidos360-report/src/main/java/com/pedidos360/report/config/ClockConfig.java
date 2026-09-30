package com.pedidos360.report.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/** Hora del sistema (TZ del contenedor, igual que ms-orders). Los tests la reemplazan por una fija. */
@Configuration
public class ClockConfig {

	@Bean
	Clock clock() {
		return Clock.systemDefaultZone();
	}
}
