import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { Link, useLocation } from 'react-router-dom';
import { getAccessToken, decodeClaims } from '../auth/token';

export default function Layout({ children, title }) {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const location = useLocation();
  
  const rolesFromId = account?.idTokenClaims?.roles || [];
  const [roles, setRoles] = useState(rolesFromId);

  useEffect(() => {
    const fetchRoles = async () => {
      if (!account) return;
      try {
        const token = await getAccessToken(instance, account);
        if (token) {
          const claims = decodeClaims(token);
          if (claims.roles) setRoles(claims.roles);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchRoles();
  }, [instance, account]);

  const isAdmin = roles.includes('Admin');
  const isAuditor = roles.includes('Auditor');
  const isOperator = roles.includes('Operator');
  
  const handleLogout = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri: `${window.location.origin}/login`,
    });
  };

  const getPrimaryRole = () => {
    if (isAdmin) return 'ADMIN';
    if (isAuditor) return 'AUDITOR';
    if (isOperator) return 'OPERATOR';
    return 'CUSTOMER';
  };

  const badgeColor = isAdmin ? '#991b1b' : (isAuditor ? '#6b21a8' : (isOperator ? '#0369a1' : '#065f46'));
  const badgeBg = isAdmin ? '#fee2e2' : (isAuditor ? '#f3e8ff' : (isOperator ? '#e0f2fe' : '#d1fae5'));

  const navItemStyle = (path) => {
    const isActive = location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));
    return {
      textDecoration: 'none',
      color: isActive ? '#0070f3' : '#334155',
      fontWeight: isActive ? '700' : '500',
      display: 'flex',
      alignItems: 'center',
      gap: '0.6rem',
      padding: '0.5rem 0.75rem',
      borderRadius: '6px',
      backgroundColor: isActive ? '#e0f2fe' : 'transparent',
      transition: 'background 0.15s ease'
    };
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <aside style={{ width: '260px', backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.25rem', fontWeight: '800', fontSize: '1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
          <span>📦</span> Pedidos360
        </div>
        
        <nav style={{ flex: 1, padding: '1rem' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <li>
              <Link to="/dashboard" style={navItemStyle('/dashboard')}>
                <span>📊</span> Inicio
              </Link>
            </li>
            <li>
              <Link to="/orders" style={navItemStyle('/orders')}>
                <span>🛍️</span> {(isAdmin || isOperator) ? 'Gestión de Pedidos' : 'Mis Pedidos'}
              </Link>
            </li>
            <li>
              <Link to="/catalog" style={navItemStyle('/catalog')}>
                <span>🏷️</span> Catálogo & Stock
              </Link>
            </li>

            {isAdmin && (
              <li>
                <Link to="/reports" style={navItemStyle('/reports')}>
                  <span>📈</span> Reportería & KPIs
                </Link>
              </li>
            )}

            {(isAdmin || isAuditor) && (
              <li>
                <Link to="/audit" style={navItemStyle('/audit')}>
                  <span>🛡️</span> Auditoría Kafka
                </Link>
              </li>
            )}
          </ul>
        </nav>

        {/* Info del ecosistema de microservicios */}
        <div style={{ padding: '0.85rem 1rem', borderTop: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b', backgroundColor: '#f1f5f9' }}>
          <div style={{ fontWeight: 'bold', color: '#334155', marginBottom: '0.2rem' }}>Microservicios Activos:</div>
          <div>• ms-bff (8080)</div>
          <div>• ms-orders (8081)</div>
          <div>• ms-catalog (8082)</div>
          <div>• ms-notify (RabbitMQ)</div>
          <div>• ms-audit / report (Kafka)</div>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ height: '65px', backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: '#0f172a' }}>{title || 'Dashboard'}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.9rem', color: '#334155' }}>
                Bienvenido, <b>{account?.name || account?.username}</b>
              </span>
              <span style={{ 
                padding: '0.25rem 0.6rem', 
                borderRadius: '9999px', 
                backgroundColor: badgeBg, 
                color: badgeColor, 
                fontSize: '0.75rem', 
                fontWeight: 'bold',
                letterSpacing: '0.05em'
              }}>
                ROL: {getPrimaryRole()}
              </span>
            </div>
            <button className="btn" onClick={handleLogout} style={{ fontSize: '0.85rem' }}>Cerrar Sesión</button>
          </div>
        </header>

        <main style={{ padding: '2rem', overflowY: 'auto', flex: 1, backgroundColor: '#f8fafc' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
