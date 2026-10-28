import { api } from './http';

export async function getAuditEvents({ user, type, orderId, from, to, limit = 200 } = {}) {
  const params = new URLSearchParams();
  if (user) params.set('user', user);
  if (type) params.set('type', type);
  if (orderId) params.set('orderId', orderId);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (limit) params.set('limit', limit);

  const qs = params.toString();
  return await api.get(`/api/audit/events${qs ? `?${qs}` : ''}`);
}

export async function getAuditEventDetail(id) {
  return await api.get(`/api/audit/events/${id}`);
}

export async function getOrderTimeline(orderId) {
  return await api.get(`/api/audit/orders/${orderId}/timeline`);
}

export async function getEventTypes() {
  return await api.get('/api/audit/event-types');
}

export async function getActors() {
  return await api.get('/api/audit/actors');
}
