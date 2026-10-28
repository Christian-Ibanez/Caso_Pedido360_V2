import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useCatalog, useOrders, changeOrderStatus } from '../../hooks/useData';
import { publishPendingCount } from '../Layout';
import {
  clp, fmtDate, fmtTime, toDate, isSameDay, orderId, orderTotal, sortByNewest, inStatusGroup,
  STATUS_GROUPS, NEXT_STATUS, NEXT_ACTION, canCancel,
} from '../../lib/format';
import { itemsSummary } from './OrderParts';
import AdminOrderDetail from './AdminOrderDetail';
import { StatusBadge, Alert, PageHead } from '../ui';
import { IconChevron, IconDownload, IconSearch, IconX, IconRefresh } from '../Icons';

const RANGES = [
  { id: 'all', label: 'Todas' },
  { id: 'today', label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: '7d', label: 'Últimos 7 días' },
];

function inRange(order, range) {
  const d = toDate(order.createdAt);
  if (range === 'all' || !d) return true;
  const now = new Date();
  if (range === 'today') return isSameDay(d, now);
  if (range === 'yesterday') {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return isSameDay(d, y);
  }
  return now - d <= 7 * 24 * 3600 * 1000;
}

export default function AdminOrders() {
  const location = useLocation();
  const { orders, loading, error, reload } = useOrders();
  const { byId } = useCatalog();
  const [tab, setTab] = useState(location.state?.tab || 'TODOS');
  const [range, setRange] = useState('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState({});
  const [errors, setErrors] = useState('');
  const [notice, setNotice] = useState('');
  const [detailId, setDetailId] = useState(location.state?.select ?? null);

  const scoped = useMemo(() => sortByNewest(orders).filter((o) => inRange(o, range)), [orders, range]);
  const term = q.trim().toLowerCase();
  const rows = scoped.filter((o) => inStatusGroup(o.status, tab)).filter((o) => {
    if (!term) return true;
    return String(orderId(o)).includes(term)
      || (o.customerName || '').toLowerCase().includes(term)
      || (o.customerEmail || '').toLowerCase().includes(term)
      || itemsSummary(o, byId).toLowerCase().includes(term);
  });

  const refresh = async () => {
    const fresh = await reload({ silent: true });
    if (fresh) publishPendingCount(fresh);
  };

  const run = async (targets, statusFor, verb) => {
    const jobs = targets.map((o) => ({ o, status: statusFor(o) })).filter((j) => j.status);
    if (jobs.length === 0) return;
    setErrors('');
    setNotice('');
    setBusy((b) => ({ ...b, ...Object.fromEntries(jobs.map((j) => [orderId(j.o), true])) }));
    const results = await Promise.allSettled(jobs.map((j) => changeOrderStatus(orderId(j.o), j.status)));
    const failed = results
      .map((r, i) => (r.status === 'rejected' ? `#${orderId(jobs[i].o)}: ${r.reason?.message}` : null))
      .filter(Boolean);
    const ok = jobs.length - failed.length;
    if (failed.length) setErrors(failed.join(' · '));
    if (ok > 0) setNotice(`${ok} ${ok === 1 ? 'pedido' : 'pedidos'} ${verb}.`);
    setSelected([]);
    setBusy({});
    await refresh();
  };

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allChecked = rows.length > 0 && rows.every((o) => selected.includes(orderId(o)));
  const toggleAll = () => setSelected(allChecked ? [] : rows.map(orderId));
  const selectedOrders = orders.filter((o) => selected.includes(orderId(o)));

  const exportCsv = () => {
    const header = ['Pedido', 'Fecha', 'Hora', 'Cliente', 'Correo', 'Productos', 'Estado', 'Total'];
    const lines = rows.map((o) => [
      orderId(o), fmtDate(o.createdAt), fmtTime(o.createdAt), o.customerName || '', o.customerEmail || '',
      itemsSummary(o, byId), o.status, Math.round(orderTotal(o)),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([`﻿${[header.join(','), ...lines].join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedidos_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (detailId != null) {
    return <AdminOrderDetail id={detailId} byId={byId} onBack={() => { setDetailId(null); refresh(); }} />;
  }

  return (
    <>
      <PageHead title="Gestión de pedidos" subtitle="Acepta, avanza o cancela pedidos. Cada cambio avisa al cliente y a la cocina.">
        <button type="button" className="btn" onClick={refresh}><IconRefresh size={16} /> Actualizar</button>
        <button type="button" className="btn" onClick={exportCsv} disabled={rows.length === 0}><IconDownload /> Exportar CSV</button>
      </PageHead>

      {error && <Alert>{error.message}</Alert>}
      <Alert onClose={() => setErrors('')}>{errors}</Alert>
      <Alert kind="success" onClose={() => setNotice('')}>{notice}</Alert>

      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Filtrar por estado">
          {STATUS_GROUPS.map((g) => (
            <button key={g.id} type="button" role="tab" aria-selected={tab === g.id} className={`tab ${tab === g.id ? 'active' : ''}`} onClick={() => { setTab(g.id); setSelected([]); }}>
              {g.label} <span className="tab-count">{scoped.filter((o) => inStatusGroup(o.status, g.id)).length}</span>
            </button>
          ))}
        </div>
        <div className="actions">
          <label className="select-inline">
            <span>Fecha</span>
            <select value={range} onChange={(e) => { setRange(e.target.value); setSelected([]); }} aria-label="Rango de fechas">
              {RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
          <label className="search">
            <IconSearch />
            <input type="search" aria-label="Buscar pedidos" placeholder="N°, cliente o producto" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="bulkbar">
          <span className="grow">{selected.length} {selected.length === 1 ? 'pedido seleccionado' : 'pedidos seleccionados'}</span>
          <button type="button" className="btn sm primary" onClick={() => run(selectedOrders, (o) => NEXT_STATUS[o.status], 'avanzados')}>Avanzar al siguiente estado</button>
          <button type="button" className="btn sm outline-dark" onClick={() => run(selectedOrders, (o) => (canCancel(o.status) ? 'CANCELADO' : null), 'cancelados')}>Cancelar pedidos</button>
          <button type="button" className="btn sm text-dark" onClick={() => setSelected([])}>Quitar selección</button>
        </div>
      )}

      <section className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrap">
          <table className="tbl" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th style={{ width: 44 }}>
                  <label className="check" style={{ minHeight: 0 }}>
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Seleccionar todos" />
                  </label>
                </th>
                <th>Pedido</th><th>Cliente</th><th>Fecha</th><th>Productos</th><th className="right">Total</th><th>Estado</th><th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const id = orderId(o);
                const next = NEXT_STATUS[o.status];
                const primary = o.status === 'CREADO';
                return (
                  <tr key={id} className={selected.includes(id) ? 'selected' : ''}>
                    <td>
                      <label className="check" style={{ minHeight: 0 }}>
                        <input type="checkbox" checked={selected.includes(id)} onChange={() => toggle(id)} aria-label={`Seleccionar pedido ${id}`} />
                      </label>
                    </td>
                    <td><button type="button" className="link-btn" onClick={() => setDetailId(id)} aria-label={`Ver detalle del pedido ${id}`}>#{id}</button></td>
                    <td style={{ maxWidth: 200 }}>
                      <span className="cell-strong">{o.customerName || 'Sin nombre'}</span>
                      <span className="cell-sub ellipsis">{o.customerEmail}</span>
                    </td>
                    <td className="num">{fmtDate(o.createdAt)}<span className="cell-sub">{fmtTime(o.createdAt)}</span></td>
                    <td className="ellipsis muted" style={{ maxWidth: 200 }} title={itemsSummary(o, byId)}>{itemsSummary(o, byId)}</td>
                    <td className="right cell-strong num">{clp(orderTotal(o))}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="nowrap">
                      <div className="actions" style={{ gap: 8, flexWrap: 'nowrap' }}>
                        {next && (
                          <button type="button" className={`btn sm ${primary ? 'primary' : ''}`} disabled={busy[id]} onClick={() => run([o], () => next, 'actualizados')}>
                            {NEXT_ACTION[o.status]} <IconChevron size={14} />
                          </button>
                        )}
                        {canCancel(o.status) && (
                          <button type="button" className="btn icon danger" disabled={busy[id]} onClick={() => run([o], () => 'CANCELADO', 'cancelados')} aria-label={`Cancelar pedido ${id}`} title="Cancelar pedido">
                            <IconX size={16} />
                          </button>
                        )}
                        {!next && <button type="button" className="btn sm ghost" onClick={() => setDetailId(id)}>Ver detalle</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {loading && orders.length === 0 && <div className="loading">Cargando pedidos…</div>}
        {!loading && rows.length === 0 && <div className="empty">No hay pedidos con este filtro.</div>}
      </section>
      <p className="subtle small" style={{ margin: 0 }}>Los pedidos con correo terminado en @fail.test sirven para probar la cola de errores (DLQ) de notificaciones.</p>
    </>
  );
}
