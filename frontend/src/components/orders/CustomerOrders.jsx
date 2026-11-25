import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRoles } from '../../hooks/useRoles';
import { useCatalog, useOrders, changeOrderStatus, payOrder } from '../../hooks/useData';
import {
  clp, fmtDate, fmtTime, orderId, orderTotal, sortByNewest, inStatusGroup, STATUS_GROUPS,
  PAYMENT_METHODS, paymentLabel, PAYMENT_DEADLINE_MIN, paymentDeadline,
} from '../../lib/format';
import { OrderTimeline, OrderLines, OrderNotifications, itemsSummary } from './OrderParts';
import NewOrderForm from './NewOrderForm';
import { isMine, rememberOwnOrder } from '../../lib/ownOrders';
import { StatusBadge, Alert, PageHead } from '../ui';
import { IconPlus, IconSearch } from '../Icons';

export default function CustomerOrders() {
  const location = useLocation();
  const { account, email } = useRoles();
  const { orders, loading, error, reload } = useOrders();
  const { products, byId } = useCatalog();
  const [tab, setTab] = useState('TODOS');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(location.state?.select ?? null);
  const [formOpen, setFormOpen] = useState(Boolean(location.state?.newOrder));
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [method, setMethod] = useState('');
  const [paying, setPaying] = useState(false);

  const mine = useMemo(
    () => sortByNewest(orders.filter((o) => isMine(o, email, orderId(o)))),
    [orders, email],
  );

  useEffect(() => {
    if (selected == null && mine.length > 0) setSelected(orderId(mine[0]));
  }, [mine, selected]);

  const term = q.trim().toLowerCase();
  const rows = mine.filter((o) => inStatusGroup(o.status, tab)).filter((o) => {
    if (!term) return true;
    return String(orderId(o)).includes(term) || itemsSummary(o, byId).toLowerCase().includes(term);
  });
  const current = mine.find((o) => orderId(o) === selected);

  const cancel = async () => {
    if (!current) return;
    setCancelling(true);
    setActionError('');
    try {
      await changeOrderStatus(orderId(current), 'CANCELADO');
      await reload({ silent: true });
      setNotice(`Cancelaste el pedido #${orderId(current)}.`);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => { setMethod(''); }, [selected]);

  const pay = async () => {
    if (!current || !method) return;
    setPaying(true);
    setActionError('');
    try {
      await payOrder(orderId(current), method);
      await reload({ silent: true });
      setNotice(`Pagaste el pedido #${orderId(current)} con ${paymentLabel(method).toLowerCase()}. Te enviaremos la boleta a tu correo.`);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setPaying(false);
    }
  };

  const onCreated = async (created) => {
    setFormOpen(false);
    if (created) rememberOwnOrder(email, orderId(created));
    await reload({ silent: true });
    if (created) setSelected(orderId(created));
    setNotice(created ? `Recibimos tu pedido #${orderId(created)}. Te avisaremos aquí y por correo cuando lo confirmen.` : 'Pedido creado.');
  };

  return (
    <>
      <PageHead title="Mis pedidos" subtitle="Revisa el estado de tus pedidos y su historial.">
        {!formOpen && <button type="button" className="btn primary" onClick={() => setFormOpen(true)}><IconPlus /> Nuevo pedido</button>}
      </PageHead>

      <Alert kind="success" onClose={() => setNotice('')}>{notice}</Alert>
      {error && <Alert>{error.message}</Alert>}

      {formOpen && (
        <NewOrderForm
          products={products}
          byId={byId}
          defaultName={account?.name || ''}
          defaultEmail={email}
          onCancel={() => setFormOpen(false)}
          onCreated={onCreated}
        />
      )}

      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Filtrar por estado">
          {STATUS_GROUPS.map((g) => (
            <button key={g.id} type="button" role="tab" aria-selected={tab === g.id} className={`tab ${tab === g.id ? 'active' : ''}`} onClick={() => setTab(g.id)}>
              {g.label} <span className="tab-count">{mine.filter((o) => inStatusGroup(o.status, g.id)).length}</span>
            </button>
          ))}
        </div>
        <label className="search">
          <IconSearch />
          <input type="search" aria-label="Buscar pedidos" placeholder="Buscar por N° o producto" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <div className="row top">
        <section className="card col-main" style={{ overflow: 'hidden' }}>
          <div className="table-wrap">
            <table className="tbl" style={{ minWidth: 720 }}>
              <thead>
                <tr><th>Pedido</th><th>Fecha</th><th>Productos</th><th className="right">Total</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const id = orderId(o);
                  return (
                    <tr
                      key={id}
                      className={`clickable ${id === selected ? 'selected' : ''}`}
                      onClick={() => setSelected(id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(id); } }}
                      tabIndex={0}
                      aria-selected={id === selected}
                    >
                      <td className="cell-strong">#{id}</td>
                      <td>{fmtDate(o.createdAt)}<span className="cell-sub">{fmtTime(o.createdAt)}</span></td>
                      <td className="ellipsis muted">{itemsSummary(o, byId)}</td>
                      <td className="right cell-strong num">{clp(orderTotal(o))}</td>
                      <td><StatusBadge status={o.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {loading && mine.length === 0 && <div className="loading">Cargando pedidos…</div>}
          {!loading && rows.length === 0 && (
            <div className="empty">{mine.length === 0 ? 'Aún no tienes pedidos. Crea el primero con "Nuevo pedido".' : 'No hay pedidos que coincidan con este filtro.'}</div>
          )}
        </section>

        {current && (
          <aside className="card panel col-side" aria-label="Detalle del pedido">
            <div className="card-head" style={{ alignItems: 'flex-start' }}>
              <div>
                <h2 className="card-title" style={{ fontSize: 22 }}>Pedido #{orderId(current)}</h2>
                <p className="muted small" style={{ margin: '4px 0 0' }}>{fmtDate(current.createdAt)}, {fmtTime(current.createdAt)}</p>
              </div>
              <StatusBadge status={current.status} />
            </div>
            <Alert onClose={() => setActionError('')}>{actionError}</Alert>
            <div>
              <h3 className="section-label">Seguimiento</h3>
              <OrderTimeline order={current} />
            </div>
            <div>
              <h3 className="section-label">Productos</h3>
              <OrderLines order={current} byId={byId} />
            </div>
            {current.deliveryAddress && (
              <div>
                <h3 className="section-label">Dirección de entrega</h3>
                <p style={{ margin: 0 }}>{current.deliveryAddress}</p>
                {current.notes && <p className="muted small" style={{ margin: '4px 0 0' }}>Nota: {current.notes}</p>}
              </div>
            )}
            <div>
              <h3 className="section-label">Pago</h3>
              {current.paidAt ? (
                <p style={{ margin: 0 }}>
                  Pagado con {paymentLabel(current.paymentMethod).toLowerCase()}
                  <span className="muted small"> · {fmtDate(current.paidAt)}, {fmtTime(current.paidAt)}</span>
                </p>
              ) : current.status === 'RECHAZADO' ? (
                <p className="muted" style={{ margin: 0 }}>Pedido rechazado: no se pagó dentro de {PAYMENT_DEADLINE_MIN} minutos.</p>
              ) : current.status === 'CANCELADO' ? (
                <p className="muted" style={{ margin: 0 }}>Pedido cancelado, no requiere pago.</p>
              ) : (
                <div className="stack-sm">
                  {paymentDeadline(current) && (
                    <p className="subtle small" style={{ margin: 0 }}>Paga antes de las {fmtTime(paymentDeadline(current))} o el pedido se rechazará.</p>
                  )}
                  <div className="chips" role="radiogroup" aria-label="Medio de pago">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={method === m.id}
                        className={`chip ${method === m.id ? 'active' : ''}`}
                        onClick={() => setMethod(m.id)}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="btn primary" onClick={pay} disabled={!method || paying}>
                    {paying ? 'Procesando pago…' : `Pagar ${clp(orderTotal(current))}`}
                  </button>
                </div>
              )}
            </div>
            <div>
              <h3 className="section-label">Notificaciones</h3>
              <OrderNotifications order={current} live />
            </div>
            {current.status === 'CREADO' && (
              <button type="button" className="btn danger" onClick={cancel} disabled={cancelling}>
                {cancelling ? 'Cancelando…' : 'Cancelar pedido'}
              </button>
            )}
          </aside>
        )}
      </div>
    </>
  );
}
