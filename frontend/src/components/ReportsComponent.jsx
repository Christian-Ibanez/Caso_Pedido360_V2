import { useCallback, useEffect, useState } from 'react';
import Layout from './Layout';
import { useRoles } from '../hooks/useRoles';
import { useCatalog } from '../hooks/useData';
import { getKpis, getTopProducts } from '../api/reports';
import { clp, clpShort, fmtTime, toDate, STATUS_LABEL } from '../lib/format';
import { ProductThumb, ServiceUnavailable, Alert, PageHead } from './ui';

const RANGES = [
  { id: 'last24h', label: 'Últimas 24 h' },
  { id: 'last7d', label: 'Últimos 7 días' },
  { id: 'last30d', label: 'Últimos 30 días' },
];

const ACTIVE_ORDER = ['CREADO', 'ACEPTADO', 'EN_PREPARACION', 'DESPACHADO'];

function minutes(v) {
  return v == null ? '—' : `${Math.round(Number(v))} min`;
}

export default function ReportsComponent() {
  const { isAdmin, resolved } = useRoles();
  const { byId } = useCatalog();
  const [range, setRange] = useState('last24h');
  const [kpis, setKpis] = useState(null);
  const [top, setTop] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    try {
      const [k, t] = await Promise.all([getKpis(range), getTopProducts(range, 5).catch(() => [])]);
      setKpis(k);
      setTop(Array.isArray(t) ? t : []);
    } catch (err) {
      setFailure(err);
      setKpis(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (resolved && isAdmin) load();
  }, [resolved, isAdmin, load]);

  if (resolved && !isAdmin) {
    return (
      <Layout title="Reportería">
        <ServiceUnavailable title="Acceso restringido">La reportería está reservada para usuarios con rol Administrador.</ServiceUnavailable>
      </Layout>
    );
  }

  const hours = (kpis?.salesByHour || []).map((h) => {
    const d = toDate(h.hour);
    const hr = d ? d.getHours() : 0;
    return { label: `${hr}h`, range: `${String(hr).padStart(2, '0')}:00 – ${String((hr + 1) % 24).padStart(2, '0')}:00`, full: fmtTime(h.hour), sales: Number(h.sales) || 0, orders: h.orders };
  });
  const maxHour = Math.max(...hours.map((h) => h.sales), 1);
  const peak = hours.reduce((best, h) => (h.sales > (best?.sales ?? -1) ? h : best), null);
  const topMax = Math.max(...top.map((t) => Number(t.sales) || 0), 1);
  const lead = kpis?.leadTime || {};
  const scaleMax = Math.max(Number(lead.maxMinutes) || 0, 60) * 1.1;
  const active = kpis?.activeByStatus || {};
  const activeTotal = ACTIVE_ORDER.reduce((s, k) => s + (Number(active[k]) || 0), 0);
  const forbidden = failure?.status === 403;

  return (
    <Layout title="Reportería">
      <PageHead title="Reportería" subtitle="Ventas, productos y tiempos de entrega.">
        <div className="tabs" role="tablist" aria-label="Rango de tiempo">
          {RANGES.map((r) => (
            <button key={r.id} type="button" role="tab" aria-selected={range === r.id} className={`tab ${range === r.id ? 'active' : ''}`} onClick={() => setRange(r.id)} disabled={Boolean(failure)}>
              {r.label}
            </button>
          ))}
        </div>
      </PageHead>

      {failure ? (
        <ServiceUnavailable title={forbidden ? 'Sin permiso para ver la reportería' : 'Reportería no disponible'} onRetry={forbidden ? undefined : load} retrying={loading}>
          {forbidden
            ? failure.message
            : 'No pudimos obtener los indicadores en este momento. La reportería se calcula a partir de los eventos de pedidos y su servicio no está respondiendo. Los pedidos y el catálogo siguen funcionando con normalidad.'}
        </ServiceUnavailable>
      ) : loading && !kpis ? (
        <div className="loading">Cargando indicadores…</div>
      ) : kpis ? (
        <>
          <div className="kpis">
            <div className="kpi">
              <div className="kpi-label">Ventas</div>
              <div className="kpi-value">{clp(kpis.totalSales)}</div>
              <div className="kpi-foot">{RANGES.find((r) => r.id === range)?.label}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Ticket promedio</div>
              <div className="kpi-value">{clp(kpis.averageTicket)}</div>
              <div className="kpi-foot">Por pedido no cancelado</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Pedidos</div>
              <div className="kpi-value">{kpis.totalOrders}</div>
              <div className="kpi-foot">{kpis.deliveredOrders} entregados · {kpis.cancelledOrders} cancelados</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Tiempo de entrega promedio</div>
              <div className="kpi-value">{minutes(lead.averageMinutes)}</div>
              <div className="kpi-foot">Desde que se crea hasta que se entrega</div>
            </div>
          </div>

          <div className="row">
            <section className="card card-pad col-main stack">
              <div className="card-head" style={{ alignItems: 'baseline' }}>
                <h2 className="card-title">Ventas por hora</h2>
                {peak && peak.sales > 0 && <span className="muted small">Hora peak: <b style={{ color: 'var(--ink)' }}>{peak.range}</b></span>}
              </div>
              {hours.length > 0 ? (
                <div className="bars ruled" style={{ height: 240, gap: 8, overflowX: 'auto' }} role="img" aria-label="Ventas por hora">
                  {hours.map((h, i) => (
                    <div className="bar-col" key={i} style={{ minWidth: 36 }} title={`${h.range}: ${h.orders} pedidos, ${clp(h.sales)}`}>
                      <span className="bar-val">{h.sales > 0 ? clpShort(h.sales) : ''}</span>
                      <div className={`bar ${h === peak ? 'hot' : ''}`} style={{ height: `${Math.round((h.sales / maxHour) * 180)}px`, maxWidth: 36 }} />
                      <span className="bar-label">{h.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ margin: 0 }}>Aún no hay ventas en este periodo.</p>
              )}
            </section>

            <section className="card card-pad col-side stack" style={{ gap: 14 }}>
              <h2 className="card-title">Productos más vendidos</h2>
              {top.map((t, i) => {
                const p = byId[t.productId] || { id: t.productId, name: `Producto #${t.productId}` };
                return (
                  <div key={t.productId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="subtle small" style={{ width: 18, fontWeight: 700 }}>{i + 1}</span>
                    <ProductThumb product={p} className="thumb sm" size={18} />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        <b className="num">{clp(t.sales)}</b>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="meter"><div style={{ width: `${Math.round(((Number(t.sales) || 0) / topMax) * 100)}%` }} /></div>
                        <span className="subtle small" style={{ whiteSpace: 'nowrap' }}>{t.quantity} u</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {top.length === 0 && <p className="muted" style={{ margin: 0 }}>Sin ventas suficientes en este periodo.</p>}
            </section>
          </div>

          <div className="row">
            <section className="card card-pad col-side stack" style={{ gap: 18 }}>
              <div className="card-head" style={{ alignItems: 'baseline' }}>
                <h2 className="card-title">Tiempo de entrega</h2>
                <span className="muted small">{lead.deliveredOrders || 0} pedidos entregados</span>
              </div>
              {lead.averageMinutes != null ? (
                <div className="range" aria-hidden="true">
                  <div className="range-track" />
                  <div className="range-span" style={{ left: `${(lead.minMinutes / scaleMax) * 100}%`, width: `${((lead.maxMinutes - lead.minMinutes) / scaleMax) * 100}%` }} />
                  <div className="range-mark" style={{ left: `${(lead.averageMinutes / scaleMax) * 100}%` }} />
                </div>
              ) : null}
              <div className="stat-tiles">
                <div className="stat-tile"><div className="label">Más rápido</div><div className="value">{minutes(lead.minMinutes)}</div></div>
                <div className="stat-tile hot"><div className="label">Promedio</div><div className="value">{minutes(lead.averageMinutes)}</div></div>
                <div className="stat-tile"><div className="label">Más lento</div><div className="value">{minutes(lead.maxMinutes)}</div></div>
              </div>
            </section>

            <section className="card card-pad col-main stack" style={{ gap: 14 }}>
              <div className="card-head" style={{ alignItems: 'baseline' }}>
                <h2 className="card-title">Pedidos activos ahora</h2>
                <span className="muted small">{activeTotal} en curso</span>
              </div>
              <div className="status-tiles">
                {ACTIVE_ORDER.map((s) => (
                  <div key={s} className={`status-tile st-${s}`}>
                    <div className="label">{STATUS_LABEL[s]}</div>
                    <div className="value">{Number(active[s]) || 0}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : (
        <Alert>No hay datos para mostrar.</Alert>
      )}
    </Layout>
  );
}
