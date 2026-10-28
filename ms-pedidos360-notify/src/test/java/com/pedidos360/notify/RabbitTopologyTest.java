package com.pedidos360.notify;

import com.pedidos360.notify.config.RabbitTopology;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.Queue;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Las colas de registro reciben copia de todo lo publicado y de todo lo rechazado, y no se descartan mensajes. */
class RabbitTopologyTest {

	private final Declarables topology = new RabbitTopology().commandTopology();

	private List<String> keys(String queue, String exchange) {
		return topology.getDeclarablesByType(Binding.class).stream()
				.filter(b -> b.getDestination().equals(queue) && b.getExchange().equals(exchange))
				.map(Binding::getRoutingKey)
				.toList();
	}

	@Test
	void historialRecibeTodosLosComandos() {
		assertThat(keys(RabbitTopology.Q_HISTORY, RabbitTopology.CMD_DIRECT))
				.containsExactlyInAnyOrder("email.send", "kitchen.ticket", "invoice.gen", "notify.inapp");
		assertThat(keys(RabbitTopology.Q_HISTORY, RabbitTopology.CMD_TOPIC)).containsExactly("#");
	}

	@Test
	void erroresRecibeTodoLoRechazado() {
		assertThat(keys(RabbitTopology.Q_ERRORS, RabbitTopology.CMD_DLX))
				.containsExactlyInAnyOrder("email.send", "kitchen.ticket", "invoice.gen", "notify.inapp");
	}

	@Test
	void lasColasDeRegistroSonDurablesYSinLimite() {
		topology.getDeclarablesByType(Queue.class).stream()
				.filter(q -> q.getName().startsWith("q.audit."))
				.forEach(q -> {
					assertThat(q.isDurable()).isTrue();
					assertThat(q.getArguments()).doesNotContainKeys("x-max-length", "x-message-ttl", "x-expires");
				});
		assertThat(topology.getDeclarablesByType(Queue.class)).extracting(Queue::getName)
				.contains(RabbitTopology.Q_HISTORY, RabbitTopology.Q_ERRORS);
	}
}
