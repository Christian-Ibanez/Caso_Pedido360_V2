import { useMsal } from '@azure/msal-react';
import { useEffect, useState } from 'react';

export default function DashboardComponent() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  
  // Extract roles from ID token claims, if available
  const roles = account?.idTokenClaims?.roles || [];
  
  const isAdmin = roles.includes('Admin');
  const isOperator = roles.includes('Operator');
  const isCustomer = roles.includes('Customer') || (!isAdmin && !isOperator); // Default if no role

  const handleLogout = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri: `${window.location.origin}/login`,
    });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      {/* Men lateral */}
      <aside style={{ width: '250px', backgroundColor: '#f4f4f4', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1rem', fontWeight: 'bold', fontSize: '1.2rem', borderBottom: '1px solid #ddd' }}>
          Pedidos360
        </div>
        <nav style={{ flex: 1, padding: '1rem' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li style={{ marginBottom: '1rem' }}><a href="#dashboard" style={{ textDecoration: 'none', color: '#333' }}>Inicio</a></li>
            <li style={{ marginBottom: '1rem' }}><a href="#pedidos" style={{ textDecoration: 'none', color: '#333' }}>Mis Pedidos</a></li>
            {isAdmin && <li style={{ marginBottom: '1rem' }}><a href="#usuarios" style={{ textDecoration: 'none', color: '#333' }}>Usuarios</a></li>}
          </ul>
        </nav>
      </aside>

      {/* Contenido Principal */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header style={{ height: '60px', backgroundColor: '#fff', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Dashboard</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span>Bienvenido, <b>{account?.name || account?.username}</b></span>
            <button className="btn" onClick={handleLogout}>Cerrar Sesin</button>
          </div>
        </header>

        {/* Resumen de actividad segn rol */}
        <main style={{ padding: '2rem', overflowY: 'auto' }}>
          <div className="section">
            <h2>Resumen de Actividad</h2>
            
            {isAdmin && (
              <div>
                <h3>Vista de Administrador</h3>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <div style={{ padding: '1.5rem', border: '1px solid #ddd', borderRadius: '8px', flex: 1, textAlign: 'center' }}>
                    <h4 style={{ margin: 0, color: '#666' }}>Pedidos Totales</h4>
                    <p style={{ fontSize: '2rem', margin: '0.5rem 0 0' }}>1,245</p>
                  </div>
                  <div style={{ padding: '1.5rem', border: '1px solid #ddd', borderRadius: '8px', flex: 1, textAlign: 'center' }}>
                    <h4 style={{ margin: 0, color: '#666' }}>Ventas del Mes</h4>
                    <p style={{ fontSize: '2rem', margin: '0.5rem 0 0' }}>$45,230</p>
                  </div>
                  <div style={{ padding: '1.5rem', border: '1px solid #ddd', borderRadius: '8px', flex: 1, textAlign: 'center' }}>
                    <h4 style={{ margin: 0, color: '#666' }}>Usuarios Activos</h4>
                    <p style={{ fontSize: '2rem', margin: '0.5rem 0 0' }}>342</p>
                  </div>
                </div>
              </div>
            )}

            {isOperator && !isAdmin && (
              <div>
                <h3>Vista de Operador</h3>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <div style={{ padding: '1.5rem', border: '1px solid #ddd', borderRadius: '8px', flex: 1, textAlign: 'center' }}>
                    <h4 style={{ margin: 0, color: '#666' }}>Pedidos Pendientes</h4>
                    <p style={{ fontSize: '2rem', margin: '0.5rem 0 0' }}>12</p>
                  </div>
                  <div style={{ padding: '1.5rem', border: '1px solid #ddd', borderRadius: '8px', flex: 1, textAlign: 'center' }}>
                    <h4 style={{ margin: 0, color: '#666' }}>Pedidos en Curso</h4>
                    <p style={{ fontSize: '2rem', margin: '0.5rem 0 0' }}>5</p>
                  </div>
                </div>
              </div>
            )}

            {isCustomer && !isAdmin && !isOperator && (
              <div>
                <h3>Vista de Cliente</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  <div style={{ padding: '1.5rem', border: '1px solid #ddd', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 1rem', color: '#333' }}>ltimos Pedidos</h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #eee', textAlign: 'left' }}>
                          <th style={{ padding: '0.5rem' }}>ID Pedido</th>
                          <th style={{ padding: '0.5rem' }}>Fecha</th>
                          <th style={{ padding: '0.5rem' }}>Estado</th>
                          <th style={{ padding: '0.5rem' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '0.5rem' }}>#P-001</td>
                          <td style={{ padding: '0.5rem' }}>20-09-2026</td>
                          <td style={{ padding: '0.5rem', color: '#0070f3' }}>En Camino</td>
                          <td style={{ padding: '0.5rem' }}>$120.00</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '0.5rem' }}>#P-002</td>
                          <td style={{ padding: '0.5rem' }}>15-09-2026</td>
                          <td style={{ padding: '0.5rem', color: 'green' }}>Entregado</td>
                          <td style={{ padding: '0.5rem' }}>$85.50</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
