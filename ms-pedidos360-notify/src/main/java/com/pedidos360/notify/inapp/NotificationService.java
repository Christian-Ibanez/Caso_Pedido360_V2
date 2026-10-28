package com.pedidos360.notify.inapp;

import com.pedidos360.notify.messaging.CommandEnvelope;
import com.pedidos360.notify.messaging.PermanentProcessingException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
public class NotificationService {

	public static final String ADMIN = "ADMIN";
	public static final String CUSTOMER = "CUSTOMER";
	private static final int PAGE = 30;

	private final NotificationRepository repository;

	public NotificationService(NotificationRepository repository) {
		this.repository = repository;
	}

	/** Guarda la notificacion del comando; si el eventId ya existe no hace nada (idempotente). */
	@Transactional
	public Notification store(CommandEnvelope command) {
		Map<String, Object> p = command.payload();
		if (p == null) {
			throw new PermanentProcessingException("Comando InAppNotify sin payload");
		}
		String audience = text(p.get("audience")).toUpperCase(Locale.ROOT);
		String recipient = normalize(p.get("recipient"));
		String title = text(p.get("title"));
		if (!ADMIN.equals(audience) && !CUSTOMER.equals(audience)) {
			throw new PermanentProcessingException("audience invalida: " + audience);
		}
		if (CUSTOMER.equals(audience) && recipient == null) {
			throw new PermanentProcessingException("Notificacion de cliente sin destinatario (payload.recipient)");
		}
		if (title.isBlank()) {
			throw new PermanentProcessingException("Notificacion sin titulo");
		}
		if (command.eventId() != null && repository.existsByEventId(command.eventId())) {
			return null;
		}
		Notification n = new Notification();
		n.setEventId(Optional.ofNullable(command.eventId()).orElse(java.util.UUID.randomUUID().toString()));
		n.setAudience(audience);
		n.setRecipient(ADMIN.equals(audience) ? null : recipient);
		n.setOrderId(p.get("orderId") instanceof Number num ? num.longValue() : null);
		n.setStatus(p.get("status") == null ? null : text(p.get("status")));
		n.setTitle(truncate(title, 160));
		n.setBody(truncate(text(p.get("body")), 500));
		n.setCreatedAt(Optional.ofNullable(command.timestamp()).orElse(Instant.now()));
		Notification saved = repository.save(n);
		log.info("[CAMPANA] {} {} pedido={} -> {}", audience, recipient == null ? "" : recipient, n.getOrderId(), n.getTitle());
		return saved;
	}

	@Transactional(readOnly = true)
	public Inbox inbox(Viewer viewer) {
		List<Notification> items = viewer.admin()
				? repository.findByAudienceOrderByIdDesc(ADMIN, PageRequest.of(0, PAGE))
				: repository.findByAudienceAndRecipientOrderByIdDesc(CUSTOMER, viewer.email(), PageRequest.of(0, PAGE));
		long unread = viewer.admin()
				? repository.countByAudienceAndReadAtIsNull(ADMIN)
				: repository.countByAudienceAndRecipientAndReadAtIsNull(CUSTOMER, viewer.email());
		return new Inbox(unread, items.stream().map(NotificationResponse::from).toList());
	}

	/** Marca como leida solo si la notificacion pertenece a quien la pide. */
	@Transactional
	public boolean markRead(Viewer viewer, Long id) {
		return repository.findById(id)
				.filter(n -> belongsTo(n, viewer))
				.map(n -> {
					if (n.getReadAt() == null) {
						n.setReadAt(Instant.now());
					}
					return true;
				})
				.orElse(false);
	}

	@Transactional
	public int markAllRead(Viewer viewer) {
		if (viewer.admin()) {
			return repository.markAllAdminRead(Instant.now());
		}
		return viewer.email() == null ? 0 : repository.markAllCustomerRead(viewer.email(), Instant.now());
	}

	static boolean belongsTo(Notification n, Viewer viewer) {
		if (viewer.admin()) {
			return ADMIN.equals(n.getAudience());
		}
		return CUSTOMER.equals(n.getAudience()) && viewer.email() != null && viewer.email().equals(n.getRecipient());
	}

	static String normalize(Object value) {
		String s = value == null ? "" : value.toString().trim().toLowerCase(Locale.ROOT);
		return s.isEmpty() ? null : s;
	}

	private static String text(Object value) {
		return value == null ? "" : value.toString().trim();
	}

	private static String truncate(String s, int max) {
		return s.length() <= max ? s : s.substring(0, max);
	}

	/** Quien consulta: lo arma el BFF a partir del JWT (correo y roles). */
	public record Viewer(String email, boolean admin) {
		public static Viewer of(String email, String roles) {
			boolean admin = false;
			if (roles != null) {
				for (String r : roles.split(",")) {
					String role = r.trim();
					if (role.equalsIgnoreCase("Admin") || role.equalsIgnoreCase("Operator")) {
						admin = true;
					}
				}
			}
			return new Viewer(normalize(email), admin);
		}
	}

	public record Inbox(long unread, List<NotificationResponse> items) {
	}
}
