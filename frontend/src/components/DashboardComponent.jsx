import { useMsal } from '@azure/msal-react';
import Layout from './Layout';
import { api } from '../api/http';
import { useState, useEffect } from 'react';
import OrderStatusBadgeComponent from './OrderStatusBadgeComponent';

export default function DashboardComponent() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const [roles, setRoles] = useState(account?.idTokenClaims?.roles || []);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Para simplificar, importamos getAccessToken y decodeClaims aquí mismo o asumimos los roles ya extraídos
    // como esto es un componente sencillo, extraeremos los roles del access token
    import('../auth/token').then(async ({ getAccessToken, decodeClaims }) => {
      try {
        const token = await getAccessToken(instance, account);
        if (token) {
          const claims = decodeClaims(token);
          if (claims.roles) setRoles(claims.roles);
        }
      } catch (e) {
        console.error(e);
      }

      // Buscar ordenes
      try {
        const data = await api.get('/api/orders');
        if (Array.isArray(data)) {
          setOrders(data);
        }
      } catch (err) {
        console.error('Error fetching orders for dashboard', err);
      } finally {
        setLoading(false);
      }
    });
  }, [instance, account]);

  const isAdmin = roles.includes('Admin');
  const isOperator = roles.includes('Operator');
  const isCustomer = roles.includes('Customer') || (!isAdmin && !isOperator);

  // Filtrar los pedidos para el customer
  const userEmail = account?.username || account?.idTokenClaims?.preferred_username;
  const myOrders = orders.filter(o => o.customerEmail?.toLowerCase() === userEmail?.toLowerCase());

  return (
    <Layout title="Dashboard">
      <div className="section">
        <h2>Resumen de Actividad</h2>
        
        {isAdmin && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
              <div style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem', textTransform: 'uppercase' }}>Ventas Totales</h4>
                  <p style={{ fontSize: '2rem', margin: '0.25rem 0 0', fontWeight: 'bold', color: '#111827' }}>
                    ${orders.reduce((sum, o) => sum + (o.total || 0), 0).toFixed(2)}
                  </p>
                </div>
                <div style={{ backgroundColor: '#ecfdf5', padding: '0.75rem', borderRadius: '50%', color: '#10b981' }}>
                  <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
              </div>
              
              <div style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem', textTransform: 'uppercase' }}>Pedidos Totales</h4>
                  <p style={{ fontSize: '2rem', margin: '0.25rem 0 0', fontWeight: 'bold', color: '#111827' }}>{orders.length}</p>
                </div>
                <div style={{ backgroundColor: '#eff6ff', padding: '0.75rem', borderRadius: '50%', color: '#3b82f6' }}>
                  <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                </div>
              </div>

              <div style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem', textTransform: 'uppercase' }}>Por Procesar</h4>
                  <p style={{ fontSize: '2rem', margin: '0.25rem 0 0', fontWeight: 'bold', color: '#b45309' }}>
                    {orders.filter(o => o.status === 'CREADO').length}
                  </p>
                </div>
                <div style={{ backgroundColor: '#fef3c7', padding: '0.75rem', borderRadius: '50%', color: '#d97706' }}>
                  <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
              </div>

              <div style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem', textTransform: 'uppercase' }}>Clientes Reg.</h4>
                  <p style={{ fontSize: '2rem', margin: '0.25rem 0 0', fontWeight: 'bold', color: '#111827' }}>
                    {new Set(orders.filter(o => o.customerEmail).map(o => o.customerEmail.toLowerCase())).size}
                  </p>
                </div>
                <div style={{ backgroundColor: '#f3e8ff', padding: '0.75rem', borderRadius: '50%', color: '#9333ea' }}>
                  <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                </div>
              </div>
            </div>

            {/* Tablas y Gráficos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
              
              {/* Pedidos Urgentes */}
              <div style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 1rem', color: '#111827' }}>Atención Requerida (Pedidos Nuevos)</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left', color: '#4b5563', fontSize: '0.875rem' }}>
                      <th style={{ padding: '0.75rem 0' }}>ID</th>
                      <th style={{ padding: '0.75rem 0' }}>Cliente</th>
                      <th style={{ padding: '0.75rem 0' }}>Fecha / Hora</th>
                      <th style={{ padding: '0.75rem 0' }}>Total</th>
                      <th style={{ padding: '0.75rem 0' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.filter(o => o.status === 'CREADO').sort((a,b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)).slice(0, 5).map(o => (
                      <tr key={o.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '1rem 0', fontWeight: 'bold', color: '#111827' }}>#{o.id}</td>
                        <td style={{ padding: '1rem 0', color: '#4b5563' }}>{o.customerName}</td>
                        <td style={{ padding: '1rem 0', color: '#6b7280' }}>
                          {o.createdAt ? new Date(o.createdAt).toLocaleString() : 'N/A'}
                        </td>
                        <td style={{ padding: '1rem 0', fontWeight: '600', color: '#111827' }}>${(o.total || 0).toFixed(2)}</td>
                        <td style={{ padding: '1rem 0' }}>
                          <a href="/orders" style={{ color: '#0070f3', textDecoration: 'none', fontWeight: '500' }}>Atender &rarr;</a>
                        </td>
                      </tr>
                    ))}
                    {orders.filter(o => o.status === 'CREADO').length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ padding: '2rem 0', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>
                          No hay pedidos urgentes pendientes. ¡Todo al día! 🎉
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Gráfico Simple de Barras */}
              <div style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 1rem', color: '#111827' }}>Ventas últimos 7 días</h3>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: '1rem', borderBottom: '1px solid #e5e7eb', height: '200px' }}>
                  {(() => {
                    const last7Days = Array.from({length: 7}, (_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() - (6 - i));
                      return d.toISOString().split('T')[0];
                    });
                    
                    const salesByDay = last7Days.map(dateStr => {
                      const dayOrders = orders.filter(o => o.createdAt && o.createdAt.startsWith(dateStr));
                      const total = dayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
                      return { date: dateStr.slice(5).replace('-', '/'), total };
                    });
                    
                    const maxSale = Math.max(...salesByDay.map(s => s.total), 10); // min height baseline

                    return salesByDay.map(day => (
                      <div key={day.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '12%', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '600' }}>${day.total.toFixed(0)}</div>
                        <div style={{ 
                          width: '100%', 
                          height: `${(day.total / maxSale) * 150}px`, 
                          backgroundColor: '#3b82f6', 
                          borderRadius: '4px 4px 0 0',
                          minHeight: '4px',
                          transition: 'height 0.3s ease'
                        }}></div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{day.date}</div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

            </div>
          </div>
        )}

        {isOperator && !isAdmin && (
          <div>
            <h3>Vista de Operador</h3>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ padding: '1.5rem', border: '1px solid #ddd', borderRadius: '8px', flex: 1, textAlign: 'center' }}>
                <h4 style={{ margin: 0, color: '#666' }}>Pedidos Totales</h4>
                <p style={{ fontSize: '2rem', margin: '0.5rem 0 0' }}>{orders.length}</p>
              </div>
              <div style={{ padding: '1.5rem', border: '1px solid #ddd', borderRadius: '8px', flex: 1, textAlign: 'center' }}>
                <h4 style={{ margin: 0, color: '#666' }}>Pedidos Pendientes</h4>
                <p style={{ fontSize: '2rem', margin: '0.5rem 0 0' }}>
                  {orders.filter(o => ['CREADO', 'ACEPTADO'].includes(o.status)).length}
                </p>
              </div>
            </div>
          </div>
        )}

        {isCustomer && !isAdmin && !isOperator && (
          <div>
            {/* Tarjetas de Métricas (KPIs) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
              <div style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', textAlign: 'center' }}>
                <h4 style={{ margin: 0, color: '#666', fontSize: '0.9rem', textTransform: 'uppercase' }}>Pedidos Activos</h4>
                <p style={{ fontSize: '2.5rem', margin: '0.5rem 0 0', fontWeight: 'bold', color: '#333' }}>
                  {myOrders.filter(o => !['ENTREGADO', 'CANCELADO'].includes(o.status)).length}
                </p>
              </div>
              <div style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', textAlign: 'center' }}>
                <h4 style={{ margin: 0, color: '#666', fontSize: '0.9rem', textTransform: 'uppercase' }}>Total Compras</h4>
                <p style={{ fontSize: '2.5rem', margin: '0.5rem 0 0', fontWeight: 'bold', color: '#333' }}>
                  ${myOrders.reduce((sum, o) => sum + (o.total || 0), 0).toFixed(2)}
                </p>
              </div>
              <div style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', textAlign: 'center' }}>
                <h4 style={{ margin: 0, color: '#666', fontSize: '0.9rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Último Estado</h4>
                {myOrders.length > 0 ? (
                  <OrderStatusBadgeComponent status={myOrders.sort((a,b) => b.id - a.id)[0].status || 'CREADO'} />
                ) : (
                  <span style={{ color: '#aaa' }}>Sin pedidos</span>
                )}
              </div>
            </div>

            {/* Banner de Acción Rápida */}
            <div style={{ marginTop: '2rem', padding: '2rem', backgroundColor: '#f0f4f8', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <div>
                <h3 style={{ margin: '0 0 0.5rem', color: '#1a365d' }}>¿Listo para un nuevo pedido?</h3>
                <p style={{ margin: 0, color: '#4a5568' }}>Disfruta del mejor pan y café directamente en tu puerta.</p>
              </div>
              <a href="/orders" style={{ textDecoration: 'none' }}>
                <button className="btn primary" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', cursor: 'pointer' }}>
                  + Crear Nuevo Pedido
                </button>
              </a>
            </div>

            {/* Tabla Resumida */}
            <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: '#333' }}>Tus Últimos Pedidos</h3>
                <a href="/orders" style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 'bold' }}>Ver todos &rarr;</a>
              </div>
              
              {loading ? (
                <p>Cargando tus pedidos...</p>
              ) : myOrders.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left', color: '#666' }}>
                      <th style={{ padding: '0.75rem 0' }}>ID Pedido</th>
                      <th style={{ padding: '0.75rem 0' }}>Estado</th>
                      <th style={{ padding: '0.75rem 0' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myOrders.sort((a,b) => b.id - a.id).slice(0, 5).map(o => (
                      <tr key={o.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '1rem 0', fontWeight: 'bold' }}>#{o.id}</td>
                        <td style={{ padding: '1rem 0' }}><OrderStatusBadgeComponent status={o.status || 'CREADO'} /></td>
                        <td style={{ padding: '1rem 0' }}>${(o.total || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#666', fontStyle: 'italic' }}>Aún no tienes pedidos registrados.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
