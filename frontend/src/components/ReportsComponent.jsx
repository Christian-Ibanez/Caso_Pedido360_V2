import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import Layout from './Layout';
import { getKpis, getTopProducts } from '../api/reports';
import { getCatalogProducts } from '../api/catalog';
import { getAccessToken, decodeClaims } from '../auth/token';

export default function ReportsComponent() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const [roles, setRoles] = useState(account?.idTokenClaims?.roles || []);
  const isAdmin = roles.includes('Admin');

  const [range, setRange] = useState('last24h');
  const [kpis, setKpis] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [catalogMap, setCatalogMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRoles = async () => {
      if (!account) return;
      try {
        const token = await getAccessToken(instance, account);
        if (token) {
          const claims = decodeClaims(token);
          if (claims.roles) setRoles(claims.roles);
        }
      } catch (err) {
        console.error('Error obteniendo roles en ReportsComponent:', err);
      }
    };
    fetchRoles();
  }, [instance, account]);

  // Cargar catálogo para mapear nombres de productos
  useEffect(() => {
    getCatalogProducts()
      .then(prods => {
        if (Array.isArray(prods)) {
          const map = {};
          prods.forEach(p => { map[p.id] = p; });
          setCatalogMap(map);
        }
      })
      .catch(() => {});
  }, []);

  const loadReportData = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const [kpiData, topProds] = await Promise.all([
        getKpis(range).catch(err => { throw err; }),
        getTopProducts(range, 5).catch(() => [])
      ]);
      setKpis(kpiData);
      setTopProducts(Array.isArray(topProds) ? topProds : []);
    } catch (err) {
      setError(err.message || 'No se pudo conectar al microservicio ms-pedidos360-report.');
      setKpis(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadReportData();
    } else {
      setLoading(false);
    }
  }, [range, isAdmin]);

  const formatMoney = (amount) => {
    const num = Number(amount) || 0;
    return `$${num.toLocaleString('es-CL')}`;
  };

  if (!isAdmin) {
    return (
      <Layout title="Reportería y Métricas">
        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '2rem', textAlign: 'center', color: '#92400e' }}>
          <h3 style={{ margin: '0 0 0.5rem', color: '#78350f' }}>Acceso Restringido</h3>
          <p style={{ margin: 0 }}>
            El módulo de Reportería y KPIs ejecutivos está reservado para usuarios con rol <strong>Administrador (Admin)</strong>.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Reportería y Métricas (ms-pedidos360-report)">
      <div>
        {/* Banner informativo del Microservicio */}
        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ fontWeight: 'bold', color: '#166534', fontSize: '1rem' }}>
              Microservicio: <code style={{ backgroundColor: '#dcfce7', color: '#14532d' }}>ms-pedidos360-report</code> (Puerto 8086)
            </span>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#15803d' }}>
              Consumidor analítico en Kafka (tópico <code>orders.events</code>). Proyecta KPIs de negocio, volumen de ventas y tiempos de entrega sin bloquear la base transaccional.
            </p>
          </div>

          {/* Selector de Rango */}
          <div style={{ display: 'flex', gap: '0.4rem', backgroundColor: '#e2e8f0', padding: '0.25rem', borderRadius: '8px' }}>
            {[
              { id: 'last24h', label: 'Últimas 24h' },
              { id: 'last7d', label: 'Últimos 7 días' },
              { id: 'last30d', label: 'Últimos 30 días' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setRange(tab.id)}
                style={{
                  padding: '0.4rem 0.9rem',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  backgroundColor: range === tab.id ? '#fff' : 'transparent',
                  color: range === tab.id ? '#111827' : '#64748b',
                  boxShadow: range === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem', color: '#9f1239' }}>
            <h4 style={{ margin: '0 0 0.5rem', fontWeight: 'bold' }}>Aviso sobre el servicio de Reportería:</h4>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>{error}</p>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#be123c', fontStyle: 'italic' }}>
              💡 Nota de Arquitectura: <code>ms-pedidos360-report</code> requiere el cluster Kafka levantado (perfil kafka: <code>docker compose --profile kafka up -d</code>).
            </p>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
            Cargando métricas y análisis en tiempo real...
          </div>
        ) : kpis ? (
          <div>
            {/* Tarjetas KPI */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              
              <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #10b981' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' }}>Ventas Totales</span>
                <div style={{ fontSize: '2rem', fontWeight: '800', color: '#111827', margin: '0.5rem 0 0' }}>
                  {formatMoney(kpis.totalSales)}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#10b981', marginTop: '0.3rem', fontWeight: '600' }}>
                  En rango {kpis.range}
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #3b82f6' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' }}>Ticket Promedio</span>
                <div style={{ fontSize: '2rem', fontWeight: '800', color: '#111827', margin: '0.5rem 0 0' }}>
                  {formatMoney(kpis.averageTicket)}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.3rem' }}>
                  Por pedido concretado
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #8b5cf6' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' }}>Pedidos Totales</span>
                <div style={{ fontSize: '2rem', fontWeight: '800', color: '#111827', margin: '0.5rem 0 0' }}>
                  {kpis.totalOrders}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.3rem' }}>
                  ✓ {kpis.deliveredOrders} entregados | ✕ {kpis.cancelledOrders} cancelados
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #f59e0b' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' }}>Lead Time Promedio</span>
                <div style={{ fontSize: '2rem', fontWeight: '800', color: '#b45309', margin: '0.5rem 0 0' }}>
                  {kpis.leadTime?.averageMinutes ? `${kpis.leadTime.averageMinutes} min` : 'N/A'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.3rem' }}>
                  {kpis.leadTime?.deliveredOrders || 0} pedidos entregados evaluados
                </div>
              </div>

            </div>

            {/* Fila 2: Estados Activos y Lead Time */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
              
              {/* Estados Activos */}
              <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 1rem', color: '#111827', fontSize: '1.1rem' }}>Pedidos Activos en Tiempo Real</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {Object.entries(kpis.activeByStatus || {}).map(([st, count]) => (
                    <div key={st}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.875rem' }}>
                        <span style={{ fontWeight: '600', color: '#374151' }}>{st}</span>
                        <span style={{ fontWeight: '700', color: '#111827' }}>{count} pedidos</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, count * 15)}%`,
                            backgroundColor: st === 'CREADO' ? '#f59e0b' : (st === 'ACEPTADO' ? '#3b82f6' : (st === 'EN_PREPARACION' ? '#8b5cf6' : '#10b981')),
                            borderRadius: '9999px'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Estadísticas de Lead Time */}
              <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 1rem', color: '#111827', fontSize: '1.1rem' }}>Eficiencia de Entrega (Lead Time)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold' }}>TIEMPO MÍNIMO</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', marginTop: '0.25rem' }}>
                      {kpis.leadTime?.minMinutes !== null && kpis.leadTime?.minMinutes !== undefined ? `${kpis.leadTime.minMinutes} min` : '-'}
                    </div>
                  </div>
                  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold' }}>TIEMPO MÁXIMO</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', marginTop: '0.25rem' }}>
                      {kpis.leadTime?.maxMinutes !== null && kpis.leadTime?.maxMinutes !== undefined ? `${kpis.leadTime.maxMinutes} min` : '-'}
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '1.5rem', lineHeight: '1.4' }}>
                  El Lead Time mide el ciclo completo desde que el cliente crea el pedido hasta la entrega en destino (<code>createdAt → deliveredAt</code>).
                </p>
              </div>

            </div>

            {/* Fila 3: Top Productos y Ventas por Hora */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
              
              {/* Top Productos */}
              <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 1rem', color: '#111827', fontSize: '1.1rem' }}>Top 5 Productos Más Vendidos</h3>
                {topProducts && topProducts.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left', fontSize: '0.85rem', color: '#4b5563' }}>
                        <th style={{ padding: '0.6rem 0' }}>Producto</th>
                        <th style={{ padding: '0.6rem 0', textAlign: 'center' }}>Cant.</th>
                        <th style={{ padding: '0.6rem 0', textAlign: 'right' }}>Total Ventas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map((p, idx) => {
                        const catalogItem = catalogMap[p.productId];
                        const name = catalogItem ? catalogItem.name : `Producto #${p.productId}`;
                        const sku = catalogItem ? catalogItem.sku : null;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '0.75rem 0' }}>
                              <div style={{ fontWeight: '600', color: '#111827' }}>{name}</div>
                              {sku && <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>SKU: {sku}</div>}
                            </td>
                            <td style={{ padding: '0.75rem 0', textAlign: 'center', fontWeight: 'bold' }}>
                              <span style={{ padding: '0.2rem 0.5rem', backgroundColor: '#eff6ff', color: '#2563eb', borderRadius: '4px' }}>
                                {p.quantity} un.
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: '700', color: '#111827' }}>
                              {formatMoney(p.sales)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: '#9ca3af', fontStyle: 'italic', padding: '1rem 0' }}>
                    No hay suficientes datos de ventas para mostrar los productos líderes en este periodo.
                  </p>
                )}
              </div>

              {/* Ventas por Hora */}
              <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 1rem', color: '#111827', fontSize: '1.1rem' }}>Histograma de Ventas por Hora</h3>
                {kpis.salesByHour && kpis.salesByHour.length > 0 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '220px', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', overflowX: 'auto' }}>
                    {(() => {
                      const maxSale = Math.max(...kpis.salesByHour.map(s => Number(s.sales) || 0), 100);
                      return kpis.salesByHour.map((item, idx) => {
                        const h = item.hour ? new Date(item.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : idx;
                        const height = Math.max(8, ((Number(item.sales) || 0) / maxSale) * 150);
                        return (
                          <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: '45px' }}>
                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600' }}>
                              {item.orders}p
                            </span>
                            <div
                              style={{
                                width: '24px',
                                height: `${height}px`,
                                backgroundColor: '#2563eb',
                                borderRadius: '4px 4px 0 0',
                                marginTop: '0.25rem'
                              }}
                              title={`Hora: ${h} | Pedidos: ${item.orders} | Ventas: ${formatMoney(item.sales)}`}
                            />
                            <span style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.4rem', whiteSpace: 'nowrap' }}>
                              {h}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <p style={{ color: '#9ca3af', fontStyle: 'italic', padding: '2rem 0', textAlign: 'center' }}>
                    Sin datos de ventas agrupadas por hora en el rango actual.
                  </p>
                )}
              </div>

            </div>
          </div>
        ) : (
          <div style={{ backgroundColor: '#fff', padding: '3rem', borderRadius: '8px', textAlign: 'center', color: '#6b7280', border: '1px solid #e5e7eb' }}>
            No se pudo obtener el informe de métricas. Revisa la conexión con ms-pedidos360-report.
          </div>
        )}
      </div>
    </Layout>
  );
}
