package com.pedidos360.audit.exception;

public class AuditEventNotFoundException extends RuntimeException {
	public AuditEventNotFoundException(Long id) {
		super("Evento de auditoria " + id + " no encontrado");
	}
}
