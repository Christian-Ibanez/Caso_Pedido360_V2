import { api } from './http';

// Campana: el BFF agrega el correo y los roles del token, así cada usuario ve solo las suyas
export function getNotifications() {
  return api.get('/api/notifications', { timeout: 8000 });
}

export function markNotificationRead(id) {
  return api.post(`/api/notifications/${id}/read`);
}

export function markAllNotificationsRead() {
  return api.post('/api/notifications/read-all');
}
