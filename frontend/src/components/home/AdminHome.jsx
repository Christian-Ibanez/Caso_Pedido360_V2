import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRoles } from '../../hooks/useRoles';
import { useCatalog, useOrders, changeOrderStatus } from '../../hooks/useData';
import { publishPendingCount } from '../Layout';
import {
  clp, clpShort, longToday, toDate, isSameDay, fmtTime, fmtAgo, orderId, orderTotal,
  STATUS_LABEL, STATUS_COLOR, plural,
} from '../../lib/format';
import { LOW_STOCK } from '../../lib/products';
import { itemsSummary } from '../orders/OrderParts';
import { ProductThumb, Alert, PageHead } from '../ui';

const ORDER_OF_STATUS = ['CREADO', 'ACEPTADO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO', 'CANCELADO'];

export default function AdminHome() {
  const { isStaff } = useRoles();
  const { orders, loading, error, reload } = useOrders();
  const { products, byId } = useCatalog();
  const [busy, setBusy] = useState({});
  const [actionError, setActionError] = useState('');

  const today = new Date();
  const todays = useMemo(() => orders.filter((o) => isSameDay(toDate(o.createdAt), today)), [orders]); // eslint-disable-line react-hooks/exhaustive-deps
  const todaysValid = todays.filter((o) => o.status !== 'CANCELADO');
  const salesToday = todaysValid.reduce((s, o) => s + orderTotal(o), 0);

  const pending = useMemo(
    () => orders.filter((o) => o.status === 'CREADO').sort((a, b) => (toDate(a.createdAt) || 0) - (toDate(b.createdAt) || 0)),
    [orders],
  );
  const inProgress = orders.filter((o) => ['ACEPTADO', 'EN_PREPARACION', 'DESPACHADO'].includes(o.status));
  const count = (s) => orders.filter((o) => o.status === s).length;

  const lowStock = useMemo(
    () => products.filter((p) => (Number(p.stock) || 0) <= LOW_STOCK).sort((a, b) => a.stock - b.stock),
    [products],
  );
  const outCount = lowStock.filter((p) => (Number(p.stock) || 0) <= 0).length;

  const last7 = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const total = orders
        .filter((o) => o.status !== 'CANCELADO' && isSameDay(toDate(o.createdAt), d))
        .reduce((s, o) => s + orderTotal(o), 0);
      days.push({
        label: i === 0 ? 'Hoy' : d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }),
        total,
        today: i === 0,
      });
    }
    return days;
  }, [orders]);
  const max7 = Math.max(...last7.map((d) => d.total), 1);
  const total7 = last7.reduce((s, d) => s + d.total, 0);

  const dist = ORDER_OF_STATUS.map((s) => ({ s, n: todays.filter((o) => o.status === s).length }));

  const act = async (order, status) => {
    const id = orderId(order);
    setBusy((b) => ({ ...b, [id]: true }));
    setActionError('');
    try {
      await changeOrderStatus(id, status);
      const fresh = await reload({ silent: true });
      if (fresh) publishPendingCount(fresh);
    } catch (err) {
      setActionError(`Pedido #${id}: ${err.message}`);
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const oldest = pending[0];

  return (
    <>
      <PageHead eyebrow={`${longToday()} · ${fmtTime(today)}`} title="Operación de hoy">
        <Link to="/catalog" state={{ create: true }} className="btn">Nuevo producto</Link>
        <Link to="/orders" state={{ tab: 'NUEVOS' }} className="btn primary">Ver pedidos por aceptar</Link>
      </PageHead>

      {error && <Alert>{error.message}</Alert>}
      <Alert onClose={() => setActionError('')}>{actionError}</Alert>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">Ventas de hoy</div>
          <div className="kpi-value">{loading ? '—' : clp(salesToday)}</div>
          <div className="kpi-foot">
            {plural(todays.length, 'pedido', 'pedidos')}{todaysValid.length > 0 ? ` · ticket promedio ${clp(salesToday / todaysValid.length)}` : ''}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Pedidos en curso</div>
          <div className="kpi-value">{loading ? '—' : inProgress.length}</div>
          <div className="kpi-foot">{count('ACEPTADO')} aceptados · {count('EN_PREPARACION')} en preparación · {count('DESPACHADO')} en camino</div>
        </div>
        <div className="kpi accent">
          <div className="kpi-label">Esperando aceptación</div>
          <div className="kpi-value">{loading ? '—' : pending.length}</div>
          <div className="kpi-foot">{oldest ? `El más antiguo espera ${fmtAgo(oldest.createdAt)}` : 'Nada pendiente'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Stock por reponer</div>
          <div className="kpi-value">{lowStock.length}</div>
          <div className="kpi-foot">{lowStock.length - outCount} con stock bajo · {plural(outCount, 'agotado', 'agotados')}</div>
        </div>
      </div>

      <div className="row">
        <section className="card card-pad col-main" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="card-head" style={{ marginBottom: 6 }}>
            <h2 className="card-title">Pedidos por aceptar</h2>
            <Link to="/orders" state={{ tab: 'NUEVOS' }} className="card-link">Ver todos</Link>
          </div>
          {pending.slice(0, 5).map((o) => (
            <div className="queue-item" key={orderId(o)}>
              <div className="grow">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 15 }}>#{orderId(o)}</b>
                  <span style={{ fontWeight: 600 }}>{o.customerName}</span>
                  <span className="subtle small">{fmtTime(o.createdAt)} · {fmtAgo(o.createdAt)}</span>
                </div>
                <div className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{itemsSummary(o, byId)}</div>
              </div>
              <b className="num">{clp(orderTotal(o))}</b>
              {isStaff && (
                <div className="actions" style={{ gap: 8 }}>
                  <button type="button" className="btn sm" disabled={busy[orderId(o)]} onClick={() => act(o, 'CANCELADO')}>Rechazar</button>
                  <button type="button" className="btn sm primary" disabled={busy[orderId(o)]} onClick={() => act(o, 'ACEPTADO')}>Aceptar</button>
                </div>
              )}
            </div>
          ))}
          {!loading && pending.length === 0 && <p className="muted" style={{ margin: '8px 0' }}>No hay pedidos esperando aceptación.</p>}
        </section>

        <section className="card card-pad col-side stack">
          <div className="card-head" style={{ alignItems: 'baseline' }}>
            <h2 className="card-title">Ventas últimos 7 días</h2>
            <span className="muted small">Total {clp(total7)}</span>
          </div>
          <div className="bars" role="img" aria-label="Ventas diarias de los últimos 7 días">
            {last7.map((d) => (
              <div className="bar-col" key={d.label}>
                <span className="bar-val">{clpShort(d.total)}</span>
                <div className={`bar ${d.today ? 'hot' : ''}`} style={{ height: `${Math.round((d.total / max7) * 170)}px` }} />
                <span className={`bar-label ${d.today ? 'hot' : ''}`}>{d.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="row">
        <section className="card card-pad" style={{ flex: '1 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="card-head" style={{ marginBottom: 8 }}>
            <h2 className="card-title">Stock por reponer</h2>
            <Link to="/catalog" className="card-link">Ir al catálogo</Link>
          </div>
          {lowStock.slice(0, 5).map((p) => {
            const out = (Number(p.stock) || 0) <= 0;
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderTop: '1px solid #f5f5f4' }}>
                <ProductThumb product={p} className="thumb lg" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div className="subtle small">{p.sku}</div>
                </div>
                <span className={`badge ${out ? 'off' : 'low'}`}>{out ? 'Agotado' : `Quedan ${p.stock}`}</span>
                <Link to="/catalog" state={{ edit: p.id }} className="btn sm">Reponer</Link>
              </div>
            );
          })}
          {lowStock.length === 0 && <p className="muted">Todo el catálogo tiene stock suficiente.</p>}
        </section>

        <section className="card card-pad stack" style={{ flex: '1 1 440px', minWidth: 0, gap: 18 }}>
          <div className="card-head" style={{ alignItems: 'baseline' }}>
            <h2 className="card-title">Pedidos de hoy por estado</h2>
            <span className="muted small">{plural(todays.length, 'pedido', 'pedidos')}</span>
          </div>
          <div className="dist" role="img" aria-label={`Distribución de los ${todays.length} pedidos de hoy por estado`}>
            {dist.filter((d) => d.n > 0).map((d) => (
              <div key={d.s} style={{ flex: `${d.n} 1 0`, background: STATUS_COLOR[d.s] }} />
            ))}
          </div>
          <div className="legend">
            {dist.map((d) => (
              <div className="legend-item" key={d.s}>
                <span className="legend-swatch" style={{ background: STATUS_COLOR[d.s] }} />
                <span className="grow">{STATUS_LABEL[d.s]}</span>
                <b>{d.n}</b>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
