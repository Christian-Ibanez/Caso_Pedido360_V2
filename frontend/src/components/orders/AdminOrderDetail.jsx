import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/http';
import { getOrderTimeline } from '../../api/audit';
import { changeOrderStatus } from '../../hooks/useData';
import { fmtDate, fmtTime, fmtDateTime, NEXT_STATUS, NEXT_ACTION, canCancel, STATUS_LABEL } from '../../lib/format';
import { OrderTimeline, OrderLines, OrderNotifications } from './OrderParts';
import { StatusBadge, Alert } from '../ui';
import { IconBack, IconChevron } from '../Icons';

const EVENT_LABEL = {
  OrderCreated: 'Pedido creado',
  OrderAccepted: 'Aceptado',
  OrderPreparing: 'En preparación',
  OrderDispatched: 'Despachado',
  OrderDelivered: 'Entregado',
  OrderCancelled: 'Cancelado',
};

export default function AdminOrderDetail({ id, byId, onBack }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);
  const [audit, setAudit] = useState({ loading: true, events: [], unavailable: false });

  const load = useCallback(async () => {
    try {
      setOrder(await api.get(`/api/orders/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  const loadAudit = useCallback(async () => {
    setAudit((a) => ({ ...a, loading: true }));
    try {
      const events = await getOrderTimeline(id);
      setAudit({ loading: false, events: Array.isArray(events) ? events : [], unavailable: false });
    } catch {
      setAudit({ loading: false, events: [], unavailable: true });
    }
  }, [id]);

  useEffect(() => { load(); loadAudit(); }, [load, loadAudit]);

  const move = async (status) => {
    setSaving(true);
    setActionError('');
    try {
      await changeOrderStatus(id, status);
      await load();
      loadAudit();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <button type="button" className="btn ghost" onClick={onBack} style={{ paddingLeft: 0, marginBottom: 4 }}>
            <IconBack size={16} /> Volver a pedidos
          </button>
          <h1>Pedido #{id}</h1>
          {order && <p>{fmtDate(order.createdAt)}, {fmtTime(order.createdAt)} · {order.customerName} · {order.customerEmail}</p>}
        </div>
        {order && <StatusBadge status={order.status} />}
      </div>

      <Alert>{error}</Alert>
      {!order && !error && <div className="loading">Cargando pedido…</div>}

      {order && (
        <div className="row top">
          <div className="col-main stack">
            <section className="card card-pad stack">
              <h2 className="card-title">Productos</h2>
              <OrderLines order={order} byId={byId} />
            </section>
            <section className="card card-pad">
              <h2 className="card-title" style={{ marginBottom: 14 }}>Cliente y entrega</h2>
              <dl className="dl">
                <dt>Cliente</dt><dd>{order.customerName}</dd>
                <dt>Correo</dt><dd>{order.customerEmail}</dd>
                <dt>Dirección</dt><dd>{order.deliveryAddress || '—'}</dd>
                <dt>Notas</dt><dd>{order.notes || '—'}</dd>
                <dt>Sucursal</dt><dd>{order.storeId ?? 1}</dd>
              </dl>
            </section>
            <section className="card card-pad stack">
              <div className="card-head">
                <h2 className="card-title">Registro de auditoría</h2>
                <button type="button" className="btn sm" onClick={loadAudit}>Actualizar</button>
              </div>
              {audit.loading && <p className="muted" style={{ margin: 0 }}>Cargando eventos…</p>}
              {!audit.loading && audit.unavailable && (
                <p className="muted" style={{ margin: 0 }}>El registro de auditoría no está disponible en este momento.</p>
              )}
              {!audit.loading && !audit.unavailable && audit.events.length === 0 && (
                <p className="muted" style={{ margin: 0 }}>Aún no hay eventos registrados para este pedido.</p>
              )}
              {audit.events.map((ev, i) => (
                <div key={ev.id || i} className="note" style={{ alignItems: 'baseline' }}>
                  <span className={`badge st-${ev.newStatus || 'CREADO'}`}>{EVENT_LABEL[ev.eventType] || ev.eventType}</span>
                  <span className="grow">
                    {ev.actor || 'sistema'}{ev.origin ? ` · IP ${ev.origin}` : ''}
                    {ev.summary && <span className="cell-sub">{ev.summary}</span>}
                  </span>
                  <span className="subtle small num">{fmtDateTime(ev.occurredAt)}</span>
                </div>
              ))}
            </section>
          </div>

          <aside className="col-side stack">
            <section className="card panel">
              <div>
                <h3 className="section-label">Seguimiento</h3>
                <OrderTimeline order={order} />
              </div>
              <Alert onClose={() => setActionError('')}>{actionError}</Alert>
              {(NEXT_STATUS[order.status] || canCancel(order.status)) ? (
                <div className="stack-sm">
                  {NEXT_STATUS[order.status] && (
                    <button type="button" className="btn primary" disabled={saving} onClick={() => move(NEXT_STATUS[order.status])}>
                      {NEXT_ACTION[order.status]}: pasar a {STATUS_LABEL[NEXT_STATUS[order.status]].toLowerCase()} <IconChevron size={16} />
                    </button>
                  )}
                  {order.status === 'CREADO' && (
                    <p className="subtle small" style={{ margin: 0 }}>Al aceptar se descuenta el stock y se envía el ticket a cocina. Si falta stock, el pedido sigue en Creado.</p>
                  )}
                  {canCancel(order.status) && (
                    <button type="button" className="btn danger" disabled={saving} onClick={() => move('CANCELADO')}>Cancelar pedido</button>
                  )}
                </div>
              ) : (
                <p className="muted small" style={{ margin: 0 }}>Este pedido ya terminó; no tiene más acciones.</p>
              )}
            </section>
            <section className="card panel">
              <div>
                <h3 className="section-label">Notificaciones al cliente</h3>
                <OrderNotifications order={order} />
              </div>
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
