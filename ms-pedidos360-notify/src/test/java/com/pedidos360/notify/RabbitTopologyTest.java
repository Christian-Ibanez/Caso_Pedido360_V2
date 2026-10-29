package com.pedidos360.notify;

import com.pedidos360.notify.config.RabbitTopology;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.Queue;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Cada flujo tiene su cola y su DLQ; lo rechazado llega a la DLQ por cmd.dead.dlx y no hay colas de auditoria. */
class RabbitTopologyTest {

	private final Declarables topology = new RabbitTopology().commandTopology();

	private List<String> keys(String queue, String exchange) {
		return topology.getDeclarablesByType(Binding.class).stream()
				.filter(b -> b.getDestination().equals(queue) && b.getExchange().equals(exchange))
				.map(Binding::getRoutingKey)
				.toList();
	}

	@Test
	void soloColasDeTrabajoYSusDlq() {
		assertThat(topology.getDeclarablesByType(Queue.class)).extracting(Queue::getName)
				.containsExactlyInAnyOrder(
						"q.cmd.email", "q.cmd.email.dlq",
						"q.cmd.kitchen", "q.cmd.kitchen.dlq",
						"q.cmd.invoice", "q.cmd.invoice.dlq",
						"q.notify.inapp", "q.notify.inapp.dlq");
	}

	@Test
	void loRechazadoDeEmailVaAEmailDlq() {
		Queue email = topology.getDeclarablesByType(Queue.class).stream()
				.filter(q -> q.getName().equals("q.cmd.email")).findFirst().orElseThrow();
		assertThat(email.getArguments())
				.containsEntry("x-dead-letter-exchange", RabbitTopology.CMD_DLX)
				.containsEntry("x-dead-letter-routing-key", "email.send");
		assertThat(keys("q.cmd.email.dlq", RabbitTopology.CMD_DLX)).containsExactly("email.send");
	}

	@Test
	void lasDlqSonDurablesYSinLimite() {
		topology.getDeclarablesByType(Queue.class).stream()
				.filter(q -> q.getName().endsWith(RabbitTopology.DLQ_SUFFIX))
				.forEach(q -> {
					assertThat(q.isDurable()).isTrue();
					assertThat(q.getArguments()).doesNotContainKeys("x-max-length", "x-message-ttl", "x-expires");
				});
	}
}
