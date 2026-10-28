package com.pedidos360.notify.inapp;

import com.pedidos360.notify.inapp.NotificationService.Inbox;
import com.pedidos360.notify.inapp.NotificationService.Viewer;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Bandeja de la campana. Solo la llama el BFF (red privada), que agrega X-User-Email y X-User-Roles desde el JWT:
 * el cliente ve sus notificaciones; Admin/Operator ven las de administracion (pedidos nuevos).
 */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

	private final NotificationService service;

	public NotificationController(NotificationService service) {
		this.service = service;
	}

	@GetMapping
	public ResponseEntity<Inbox> inbox(@RequestHeader(value = "X-User-Email", required = false) String email,
			@RequestHeader(value = "X-User-Roles", required = false) String roles) {
		Viewer viewer = Viewer.of(email, roles);
		if (!viewer.admin() && viewer.email() == null) {
			return ResponseEntity.badRequest().build();
		}
		return ResponseEntity.ok(service.inbox(viewer));
	}

	@PostMapping("/{id}/read")
	public ResponseEntity<Void> read(@PathVariable Long id,
			@RequestHeader(value = "X-User-Email", required = false) String email,
			@RequestHeader(value = "X-User-Roles", required = false) String roles) {
		return service.markRead(Viewer.of(email, roles), id) ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
	}

	@PostMapping("/read-all")
	public Map<String, Integer> readAll(@RequestHeader(value = "X-User-Email", required = false) String email,
			@RequestHeader(value = "X-User-Roles", required = false) String roles) {
		return Map.of("updated", service.markAllRead(Viewer.of(email, roles)));
	}
}
