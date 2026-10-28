// Estado compartido de la campana. Un solo sondeo por pestaña (cada 10 s) mientras haya alguien suscrito.
// Las notificaciones las genera ms-orders, viajan por RabbitMQ (q.notify.inapp) y ms-notify las guarda.
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api/notifications';

const POLL_MS = 10000;
export const NEW_NOTIFICATIONS_EVENT = 'p360:notifications:new';

let state = { unread: 0, items: [], ready: false, unavailable: false };
let lastSeenId = null;
let timer = null;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn(state));
}

async function poll() {
  try {
    const data = await getNotifications();
    const items = Array.isArray(data?.items) ? data.items : [];
    const maxId = items.reduce((m, n) => Math.max(m, n.id || 0), 0);
    const fresh = lastSeenId == null ? [] : items.filter((n) => n.id > lastSeenId && !n.read);
    lastSeenId = Math.max(lastSeenId ?? 0, maxId);
    state = { unread: Number(data?.unread) || 0, items, ready: true, unavailable: false };
    emit();
    if (fresh.length > 0) {
      window.dispatchEvent(new CustomEvent(NEW_NOTIFICATIONS_EVENT, { detail: fresh }));
    }
  } catch {
    state = { ...state, ready: true, unavailable: true };
    emit();
  }
}

export function subscribeNotifications(fn) {
  listeners.add(fn);
  fn(state);
  if (!timer) {
    poll();
    timer = setInterval(poll, POLL_MS);
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function refreshNotifications() {
  return poll();
}

export async function markRead(id) {
  const target = state.items.find((n) => n.id === id);
  if (!target || target.read) return;
  state = {
    ...state,
    unread: Math.max(0, state.unread - 1),
    items: state.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
  };
  emit();
  try {
    await markNotificationRead(id);
  } catch {
    poll();
  }
}

export async function markAllRead() {
  state = { ...state, unread: 0, items: state.items.map((n) => ({ ...n, read: true })) };
  emit();
  try {
    await markAllNotificationsRead();
  } catch {
    poll();
  }
}

export function resetNotifications() {
  state = { unread: 0, items: [], ready: false, unavailable: false };
  lastSeenId = null;
}
