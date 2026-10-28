package com.pedidos360.notify.handler;

import com.pedidos360.notify.consumer.CommandEnvelope;
import com.pedidos360.notify.inapp.NotificationService;
import org.springframework.stereotype.Component;

/**
 * Comando InAppNotify (q.notify.inapp): guarda la notificacion que el frontend muestra en la campana.
 * Pedido nuevo -> administradores; pedido confirmado (en proceso) y demas cambios -> el cliente.
 */
@Component
public class InAppNotifier implements CommandHandler {

	private final NotificationService service;

	public InAppNotifier(NotificationService service) {
		this.service = service;
	}

	@Override
	public void handle(CommandEnvelope command) {
		service.store(command);
	}
}
