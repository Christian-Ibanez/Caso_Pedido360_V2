// Formatos y metadatos compartidos por las vistas

/** Pesos chilenos sin decimales: 1800 -> "$1.800". */
export function clp(value) {
  const n = Math.round(Number(value) || 0);
  return `$${n.toLocaleString('es-CL')}`;
}

/** Montos grandes abreviados para etiquetas de gráficos: 86430 -> "$86k". */
export function clpShort(value) {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n)}`;
}

export function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
}

export function fmtTime(value) {
  const d = toDate(value);
  return d ? d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '—';
}

export function fmtDateTime(value) {
  const d = toDate(value);
  return d ? `${fmtDate(d)} ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })}` : '—';
}

/** "1 producto" / "3 productos". */
export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

export function isSameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Hoy, 10:42", "Ayer, 18:05" o "26/10/2026, 13:30". */
export function fmtRelativeDay(value) {
  const d = toDate(value);
  if (!d) return '—';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d, today)) return `Hoy, ${fmtTime(d)}`;
  if (isSameDay(d, yesterday)) return `Ayer, ${fmtTime(d)}`;
  return `${fmtDate(d)}, ${fmtTime(d)}`;
}

/** "hace 12 min" para colas de trabajo. */
export function fmtAgo(value) {
  const d = toDate(value);
  if (!d) return '';
  const min = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export function longToday() {
  const s = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Estados del pedido (deben coincidir con OrderStatus de ms-pedidos360-orders)
// ---------------------------------------------------------------------------
export const FLOW = ['CREADO', 'ACEPTADO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO'];

export const STATUS_LABEL = {
  CREADO: 'Pendiente',
  ACEPTADO: 'En proceso',
  EN_PREPARACION: 'En preparación',
  DESPACHADO: 'Despachado',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

export const STATUS_BADGE = {
  CREADO: 'PENDIENTE',
  ACEPTADO: 'EN PROCESO',
  EN_PREPARACION: 'EN PREPARACIÓN',
  DESPACHADO: 'DESPACHADO',
  ENTREGADO: 'ENTREGADO',
  CANCELADO: 'CANCELADO',
};

export const STATUS_COLOR = {
  CREADO: '#f59e0b',
  ACEPTADO: '#3b82f6',
  EN_PREPARACION: '#8b5cf6',
  DESPACHADO: '#0891b2',
  ENTREGADO: '#16a34a',
  CANCELADO: '#a8a29e',
};

/** Siguiente estado válido y el texto del botón que lo dispara. */
export const NEXT_STATUS = {
  CREADO: 'ACEPTADO',
  ACEPTADO: 'EN_PREPARACION',
  EN_PREPARACION: 'DESPACHADO',
  DESPACHADO: 'ENTREGADO',
};

export const NEXT_ACTION = {
  CREADO: 'Confirmar',
  ACEPTADO: 'Preparar',
  EN_PREPARACION: 'Despachar',
  DESPACHADO: 'Entregar',
};

/** El backend permite cancelar desde cualquier estado no terminal. */
export function canCancel(status) {
  return Boolean(NEXT_STATUS[status]);
}

export function inStatusGroup(status, group) {
  switch (group) {
    case 'NUEVOS': return status === 'CREADO';
    case 'PROCESO': return ['ACEPTADO', 'EN_PREPARACION', 'DESPACHADO'].includes(status);
    case 'COMPLETADOS': return status === 'ENTREGADO';
    case 'CANCELADOS': return status === 'CANCELADO';
    default: return true;
  }
}

export const STATUS_GROUPS = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'NUEVOS', label: 'Pendientes' },
  { id: 'PROCESO', label: 'En proceso' },
  { id: 'COMPLETADOS', label: 'Completados' },
  { id: 'CANCELADOS', label: 'Cancelados' },
];

export function orderId(order) {
  return order?.id ?? order?.orderId;
}

export function orderTotal(order) {
  if (order?.total != null) return Number(order.total);
  return (order?.items || []).reduce((s, i) => s + Number(i.subtotal ?? i.quantity * i.unitPrice ?? 0), 0);
}

/** Hora de cada estado alcanzado según los campos que entrega ms-orders. */
export function statusTimes(order) {
  return {
    CREADO: order?.createdAt,
    ACEPTADO: order?.acceptedAt,
    EN_PREPARACION: null,
    DESPACHADO: order?.dispatchedAt,
    ENTREGADO: order?.deliveredAt,
    CANCELADO: order?.status === 'CANCELADO' ? order?.updatedAt : null,
  };
}

export function sortByNewest(orders) {
  return [...orders].sort((a, b) => (orderId(b) || 0) - (orderId(a) || 0));
}
