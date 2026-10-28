import { useEffect, useState } from 'react';
import { FLOW, STATUS_LABEL, statusTimes, fmtTime, clp, orderTotal, toDate } from '../../lib/format';
import { subscribeNotifications } from '../../lib/notifications';
import { IconCheck, IconMail, IconBell } from '../Icons';

/** Avance horizontal Creado → Entregado (tarjeta "Tu pedido en curso"). */
export function OrderProgress({ order }) {
  const status = order?.status || 'CREADO';
  const current = FLOW.indexOf(status);
  const times = statusTimes(order);
  return (
    <div className="progress" role="list" aria-label="Avance del pedido">
      {FLOW.map((s, i) => {
        const state = i < current || status === 'ENTREGADO' ? 'done' : i === current ? 'current' : '';
        return (
          <div key={s} style={{ display: 'contents' }}>
            {i > 0 && <div className={`progress-line ${i <= current ? 'done' : ''}`} />}
            <div className={`progress-step ${state}`} role="listitem" aria-current={i === current ? 'step' : undefined}>
              <div className="progress-dot">{state === 'done' && <IconCheck size={16} />}</div>
              <div className="progress-label">{STATUS_LABEL[s]}</div>
              <div className="progress-time">{times[s] ? fmtTime(times[s]) : '—'}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Línea de tiempo vertical del detalle de un pedido. */
export function OrderTimeline({ order }) {
  const status = order?.status || 'CREADO';
  const steps = status === 'CANCELADO' ? ['CREADO', 'CANCELADO'] : FLOW;
  const current = steps.indexOf(status);
  const times = statusTimes(order);
  return (
    <div className="timeline">
      {steps.map((s, i) => {
        const reached = i <= current;
        const cls = [
          'tl-item',
          reached ? (s === 'CANCELADO' ? 'cancel' : 'reached') : '',
          i === current ? 'current' : '',
          i < current ? 'line-done' : '',
        ].join(' ');
        return (
          <div key={s} className={cls}>
            <div className="tl-rail">
              <div className="tl-dot" />
              {i < steps.length - 1 && <div className="tl-line" />}
            </div>
            <div className="tl-body">
              <span className="tl-label">{STATUS_LABEL[s]}</span>
              <span className="num">{times[s] ? fmtTime(times[s]) : '—'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function productName(byId, productId) {
  return byId?.[productId]?.name || `Producto #${productId}`;
}

export function itemsSummary(order, byId) {
  return (order?.items || []).map((i) => `${i.quantity}× ${productName(byId, i.productId)}`).join(', ');
}

/** Productos con cantidad, subtotal y total. */
export function OrderLines({ order, byId }) {
  const items = order?.items || [];
  return (
    <div className="lines">
      {items.map((i, idx) => (
        <div className="line" key={i.id ?? idx}>
          <span>{i.quantity} × {productName(byId, i.productId)}</span>
          <span className="num">{clp(i.subtotal ?? i.quantity * i.unitPrice)}</span>
        </div>
      ))}
      {items.length === 0 && <div className="muted">Sin detalle de productos.</div>}
      <div className="line total">
        <span>Total</span>
        <span className="num">{clp(orderTotal(order))}</span>
      </div>
    </div>
  );
}

/**
 * Avisos que el cliente recibe en cada etapa. Todos salen de ms-notify a través de RabbitMQ:
 * correo, ticket de cocina, boleta y el aviso en la campana de la app.
 * Con `live` se muestran los avisos reales de la campana del usuario para este pedido.
 */
export function OrderNotifications({ order, live = false }) {
  const [inbox, setInbox] = useState(null);
  useEffect(() => (live ? subscribeNotifications(setInbox) : undefined), [live]);

  const times = statusTimes(order);
  const status = order?.status;
  const id = order?.id ?? order?.orderId;
  const notes = [{ text: 'Te enviamos un correo de confirmación', time: times.CREADO, kind: 'mail' }];
  if (times.ACEPTADO) notes.push({ text: 'La cocina recibió tu pedido', time: times.ACEPTADO, kind: 'mail' });
  if (status === 'ENTREGADO') notes.push({ text: 'Boleta electrónica enviada a tu correo', time: times.ENTREGADO, kind: 'mail' });
  if (status === 'CANCELADO') notes.push({ text: 'Te avisamos por correo la cancelación', time: times.CANCELADO, kind: 'mail' });

  const real = (inbox?.items || []).filter((n) => n.audience === 'CUSTOMER' && String(n.orderId) === String(id));
  if (real.length > 0) {
    real.forEach((n) => notes.push({ text: n.title, time: n.createdAt, kind: 'app', key: `app-${n.id}` }));
  } else if (times.ACEPTADO) {
    notes.push({ text: 'Aviso en la app: tu pedido está en proceso', time: times.ACEPTADO, kind: 'app' });
  }
  notes.sort((a, b) => (toDate(a.time)?.getTime() || 0) - (toDate(b.time)?.getTime() || 0));

  return (
    <div className="notes">
      {notes.map((n) => (
        <div className="note" key={n.key || n.text}>
          {n.kind === 'app' ? <IconBell /> : <IconMail />}
          <span className="grow">{n.text}</span>
          <span className="subtle num">{n.time ? fmtTime(n.time) : ''}</span>
        </div>
      ))}
    </div>
  );
}
