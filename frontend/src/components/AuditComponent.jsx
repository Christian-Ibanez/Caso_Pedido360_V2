import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from './Layout';
import { useRoles } from '../hooks/useRoles';
import { getAuditEvents, getAuditEventDetail, getEventTypes, getActors } from '../api/audit';
import { fmtDateTime, fmtTime, fmtDate, STATUS_BADGE } from '../lib/format';
import { ServiceUnavailable, Alert, PageHead } from './ui';
import { IconArrow, IconRefresh } from './Icons';

const EVENT_LABEL = {
  OrderCreated: 'Pedido creado',
  OrderAccepted: 'Aceptado',
  OrderPreparing: 'En preparación',
  OrderDispatched: 'Despachado',
  OrderDelivered: 'Entregado',
  OrderCancelled: 'Cancelado',
};
const DEFAULT_TYPES = Object.keys(EVENT_LABEL);

function eventStatus(ev) {
  return ev?.newStatus || (ev?.eventType === 'OrderCreated' ? 'CREADO' : null);
}

function prettyPayload(raw) {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export default function AuditComponent() {
  const { isAdmin, isAuditor, resolved } = useRoles();
  const canAccess = isAdmin || isAuditor;

  const [events, setEvents] = useState([]);
  const [types, setTypes] = useState(DEFAULT_TYPES);
  const [actors, setActors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState(null);

  const [type, setType] = useState('');
  const [actor, setActor] = useState('');
  const [orderFilter, setOrderFilter] = useState('');
  const [limit, setLimit] = useState(100);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    try {
      const data = await getAuditEvents({ type: type || undefined, user: actor || undefined, orderId: orderFilter.trim() || undefined, limit });
      const list = Array.isArray(data) ? data : [];
      setEvents(list);
      setSelectedId((cur) => (list.some((e) => e.id === cur) ? cur : list[0]?.id ?? null));
    } catch (err) {
      setFailure(err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [type, actor, orderFilter, limit]);

  // Filtros: tipo, usuario y límite recargan al instante; el N° de pedido al presionar Enter o "Filtrar"
  useEffect(() => {
    if (resolved && canAccess) load();
  }, [resolved, canAccess, type, actor, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!resolved || !canAccess) return;
    getEventTypes().then((t) => Array.isArray(t) && t.length && setTypes(t)).catch(() => {});
    getActors().then((a) => Array.isArray(a) && setActors(a)).catch(() => {});
  }, [resolved, canAccess]);

  useEffect(() => {
    if (selectedId == null) { setDetail(null); return; }
    let alive = true;
    setDetailError('');
    getAuditEventDetail(selectedId)
      .then((d) => alive && setDetail(d))
      .catch((err) => alive && setDetailError(err.message));
    return () => { alive = false; };
  }, [selectedId]);

  if (resolved && !canAccess) {
    return (
      <Layout title="Auditoría">
        <ServiceUnavailable title="Acceso restringido">La auditoría está reservada para usuarios con rol Administrador o Auditor.</ServiceUnavailable>
      </Layout>
    );
  }

  const selected = events.find((e) => e.id === selectedId);
  const forbidden = failure?.status === 403;

  return (
    <Layout title="Auditoría">
      <PageHead title="Auditoría" subtitle="Quién cambió cada pedido, cuándo y desde dónde. El registro no se puede modificar.">
        <button type="button" className="btn" onClick={load} disabled={loading}><IconRefresh size={16} /> Actualizar</button>
      </PageHead>

      {failure ? (
        <ServiceUnavailable title={forbidden ? 'Sin permiso para ver la auditoría' : 'Auditoría no disponible'} onRetry={forbidden ? undefined : load} retrying={loading}>
          {forbidden
            ? failure.message
            : 'No pudimos obtener el registro de auditoría en este momento. Se arma a partir de los eventos de pedidos y su servicio no está respondiendo. Los pedidos se siguen guardando con normalidad.'}
        </ServiceUnavailable>
      ) : (
        <>
          <form className="card filters-card" onSubmit={(e) => { e.preventDefault(); load(); }}>
            <div className="filters-row" style={{ alignItems: 'flex-end' }}>
              <label className="field" style={{ flex: '1 1 180px' }}>Tipo de evento
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="">Todos los eventos</option>
                  {types.map((t) => <option key={t} value={t}>{EVENT_LABEL[t] || t}</option>)}
                </select>
              </label>
              <label className="field" style={{ flex: '1 1 200px' }}>Usuario
                <select value={actor} onChange={(e) => setActor(e.target.value)}>
                  <option value="">Todos los usuarios</option>
                  {actors.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label className="field" style={{ flex: '0 1 140px' }}>N° de pedido
                <input type="search" inputMode="numeric" placeholder="ej. 22" value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)} />
              </label>
              <label className="field" style={{ flex: '0 1 120px' }}>Mostrar
                <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                  {[50, 100, 200, 500].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <button type="submit" className="btn primary">Filtrar</button>
              <button type="button" className="btn ghost" onClick={() => { setType(''); setActor(''); setOrderFilter(''); }}>Limpiar</button>
            </div>
          </form>

          <div className="row top" style={{ gap: 20 }}>
            <section className="card col-main" style={{ overflow: 'hidden', flexBasis: 600 }}>
              <div className="small muted" style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
                {loading ? 'Cargando eventos…' : `${events.length} ${events.length === 1 ? 'evento' : 'eventos'}`}
              </div>
              <div className="table-wrap">
                <table className="tbl" style={{ minWidth: 760 }}>
                  <thead>
                    <tr><th>Fecha</th><th>Evento</th><th>Pedido</th><th>Usuario</th><th>Cambio</th></tr>
                  </thead>
                  <tbody>
                    {events.map((ev) => {
                      const st = eventStatus(ev);
                      return (
                        <tr
                          key={ev.id}
                          className={`clickable ${ev.id === selectedId ? 'selected' : ''}`}
                          onClick={() => setSelectedId(ev.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(ev.id); } }}
                          tabIndex={0}
                          aria-selected={ev.id === selectedId}
                        >
                          <td className="num">{fmtDate(ev.occurredAt)}<span className="cell-sub">{fmtTime(ev.occurredAt)}</span></td>
                          <td><span className={`badge ${st ? `st-${st}` : 'off'}`}>{EVENT_LABEL[ev.eventType] || ev.eventType}</span></td>
                          <td className="cell-strong">#{ev.entityId}</td>
                          <td style={{ maxWidth: 240 }}>
                            <span className="cell-strong ellipsis" style={{ display: 'block' }}>{ev.actor || 'sistema'}</span>
                            {ev.origin && <span className="cell-sub">IP {ev.origin}</span>}
                          </td>
                          <td className="small">
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              {ev.previousStatus && (<><span className="subtle">{STATUS_BADGE[ev.previousStatus] || ev.previousStatus}</span><IconArrow size={14} style={{ color: '#a8a29e' }} /></>)}
                              <b>{STATUS_BADGE[ev.newStatus] || ev.newStatus || '—'}</b>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!loading && events.length === 0 && <div className="empty">No hay eventos con estos filtros.</div>}
            </section>

            {selected && (
              <aside className="card panel col-side" style={{ flexBasis: 340, gap: 16 }} aria-label="Detalle del evento">
                <div className="card-head" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div className="subtle small">Evento #{selected.id}</div>
                    <h2 className="card-title" style={{ fontSize: 20, marginTop: 2 }}>{EVENT_LABEL[selected.eventType] || selected.eventType} · #{selected.entityId}</h2>
                  </div>
                  <span className={`badge ${eventStatus(selected) ? `st-${eventStatus(selected)}` : 'off'}`}>{selected.eventType}</span>
                </div>
                <dl className="dl">
                  <dt>Fecha</dt><dd className="num">{fmtDateTime(selected.occurredAt)}</dd>
                  <dt>Usuario</dt><dd>{selected.actor || 'sistema'}</dd>
                  <dt>IP de origen</dt><dd className="mono">{selected.origin || '—'}</dd>
                  <dt>Cambio</dt><dd>{selected.previousStatus ? `${STATUS_BADGE[selected.previousStatus]} → ${STATUS_BADGE[selected.newStatus]}` : `Nuevo pedido (${STATUS_BADGE[selected.newStatus] || 'CREADO'})`}</dd>
                  <dt>Resumen</dt><dd>{selected.summary || '—'}</dd>
                  {selected.sourceService && (<><dt>Origen</dt><dd>{selected.sourceService}</dd></>)}
                </dl>
                <div>
                  <h3 className="section-label">Evento original</h3>
                  <Alert>{detailError}</Alert>
                  {detail?.payload ? <pre className="code">{prettyPayload(detail.payload)}</pre> : !detailError && <p className="muted small" style={{ margin: 0 }}>Cargando…</p>}
                  {detail?.kafkaTopic && <p className="subtle small" style={{ margin: '8px 0 0' }}>Tópico {detail.kafkaTopic} · partición {detail.kafkaPartition} · offset {detail.kafkaOffset}</p>}
                </div>
                <Link to="/orders" state={{ select: Number(selected.entityId) }} className="btn">Ver pedido #{selected.entityId}</Link>
              </aside>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}
