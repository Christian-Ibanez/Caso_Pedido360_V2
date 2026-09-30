package com.pedidos360.orders.service;

import com.pedidos360.orders.client.CatalogClient;
import com.pedidos360.orders.dto.OrderRequest;
import com.pedidos360.orders.dto.OrderResponse;
import com.pedidos360.orders.exception.InvalidStatusTransitionException;
import com.pedidos360.orders.exception.OrderNotFoundException;
import com.pedidos360.orders.messaging.OrderEvent;
import com.pedidos360.orders.messaging.RequestMetadata;
import com.pedidos360.orders.model.CustomerOrder;
import com.pedidos360.orders.model.OrderItem;
import com.pedidos360.orders.model.OrderStatus;
import com.pedidos360.orders.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderService {

	/** Estados en que el stock del pedido ya fue descontado (si se cancela hay que reponerlo). */
	private static final EnumSet<OrderStatus> STOCK_TAKEN =
			EnumSet.of(OrderStatus.ACEPTADO, OrderStatus.EN_PREPARACION, OrderStatus.DESPACHADO);

	private final OrderRepository repository;
	private final CatalogClient catalogClient;
	private final ApplicationEventPublisher events;

	@Transactional
	public OrderResponse create(OrderRequest request) {
		CustomerOrder order = new CustomerOrder();
		order.setStatus(OrderStatus.CREADO);
		apply(order, request);
		OrderResponse saved = OrderResponse.from(repository.save(order));
		publish(OrderEvent.CREATED, null, saved);
		return saved;
	}

	@Transactional(readOnly = true)
	public OrderResponse findById(Long id) {
		return OrderResponse.from(get(id));
	}

	@Transactional(readOnly = true)
	public List<OrderResponse> search(OrderStatus status, LocalDateTime from, LocalDateTime to) {
		return repository.findAll(OrderRepository.filter(status, from, to), Sort.by(Sort.Direction.DESC, "createdAt"))
				.stream().map(OrderResponse::from).toList();
	}

	@Transactional
	public OrderResponse update(Long id, OrderRequest request) {
		CustomerOrder order = get(id);
		if (order.getStatus() != OrderStatus.CREADO) {
			throw new InvalidStatusTransitionException(
					"Solo se puede editar un pedido en estado CREADO (estado actual: " + order.getStatus() + ")");
		}
		apply(order, request);
		OrderResponse saved = OrderResponse.from(repository.save(order));
		publish(OrderEvent.UPDATED, saved.status(), saved);
		return saved;
	}

	@Transactional
	public OrderResponse changeStatus(Long id, OrderStatus newStatus) {
		CustomerOrder order = get(id);
		OrderStatus current = order.getStatus();

		if (!current.canTransitionTo(newStatus)) {
			throw new InvalidStatusTransitionException(
					"No se puede pasar de " + current + " a " + newStatus
							+ ". Permitidos: " + current.allowedTransitions());
		}

		order.setStatus(newStatus);
		LocalDateTime now = LocalDateTime.now();
		switch (newStatus) {
			case ACEPTADO -> {
				order.setAcceptedAt(now);
				// Regla del caso: el stock decrece al aceptar (si no alcanza, 409 y el pedido sigue CREADO)
				catalogClient.decreaseStock(order);
			}
			case DESPACHADO -> order.setDispatchedAt(now);
			case ENTREGADO -> order.setDeliveredAt(now);
			case CANCELADO -> {
				if (STOCK_TAKEN.contains(current)) {
					catalogClient.increaseStock(order);
				}
			}
			default -> { }
		}
		OrderResponse saved = OrderResponse.from(repository.save(order));
		// Kafka orders.events (reporteria/auditoria) + RabbitMQ email/cocina/boleta, despues del commit
		publish(OrderEvent.typeFor(newStatus), current, saved);
		return saved;
	}

	@Transactional
	public void delete(Long id) {
		CustomerOrder order = get(id);
		OrderResponse snapshot = OrderResponse.from(order);
		repository.delete(order);
		publish(OrderEvent.DELETED, snapshot.status(), snapshot);
	}

	private void publish(String type, OrderStatus previousStatus, OrderResponse order) {
		events.publishEvent(OrderEvent.of(type, previousStatus, order, RequestMetadata.current()));
	}

	private CustomerOrder get(Long id) {
		return repository.findById(id).orElseThrow(() -> new OrderNotFoundException(id));
	}

	private void apply(CustomerOrder order, OrderRequest request) {
		order.setStoreId(request.storeId());
		order.setCustomerName(request.customerName());
		order.setCustomerEmail(request.customerEmail());
		order.setDeliveryAddress(request.deliveryAddress());
		order.setNotes(request.notes());
		order.replaceItems(request.items().stream().map(i -> {
			OrderItem item = new OrderItem();
			item.setProductId(i.productId());
			item.setQuantity(i.quantity());
			item.setUnitPrice(i.unitPrice());
			return item;
		}).toList());
	}
}
