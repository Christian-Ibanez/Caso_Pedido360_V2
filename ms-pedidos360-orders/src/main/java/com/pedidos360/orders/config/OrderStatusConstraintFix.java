package com.pedidos360.orders.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;

/**
 * Hibernate crea un CHECK con los valores del enum al crear P360_ORDERS en Oracle, y ddl-auto=update no lo
 * actualiza cuando el enum suma un estado (RECHAZADO). Al partir se borra ese CHECK si quedo desactualizado;
 * en H2 (local/tests) la tabla se crea de cero y no hace falta.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrderStatusConstraintFix {

	private final DataSource dataSource;

	@EventListener(ApplicationReadyEvent.class)
	public void dropStaleStatusCheck() {
		try (Connection c = dataSource.getConnection()) {
			if (!c.getMetaData().getDatabaseProductName().toLowerCase().contains("oracle")) {
				return;
			}
		} catch (Exception ex) {
			log.warn("No se pudo revisar la base de datos: {}", ex.getMessage());
			return;
		}
		try {
			new JdbcTemplate(dataSource).execute("""
					BEGIN
					  FOR c IN (SELECT constraint_name FROM user_constraints
					            WHERE table_name = 'P360_ORDERS' AND constraint_type = 'C'
					              AND search_condition_vc LIKE '%CANCELADO%'
					              AND search_condition_vc NOT LIKE '%RECHAZADO%') LOOP
					    EXECUTE IMMEDIATE 'ALTER TABLE P360_ORDERS DROP CONSTRAINT ' || c.constraint_name;
					  END LOOP;
					END;""");
			log.info("CHECK de estados de P360_ORDERS revisado (RECHAZADO permitido)");
		} catch (Exception ex) {
			log.warn("No se pudo actualizar el CHECK de estados de P360_ORDERS: {}", ex.getMessage());
		}
	}
}
