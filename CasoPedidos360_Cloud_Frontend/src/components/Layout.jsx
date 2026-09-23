import { useMsal } from '@azure/msal-react';
import { Link, useLocation } from 'react-router-dom';

export default function Layout({ children, title }) {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const location = useLocation();
  
  const roles = account?.idTokenClaims?.roles || [];
  const isAdmin = roles.includes('Admin');
  
  const handleLogout = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri: `${window.location.origin}/login`,
    });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <aside style={{ width: '250px', backgroundColor: '#f4f4f4', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1rem', fontWeight: 'bold', fontSize: '1.2rem', borderBottom: '1px solid #ddd' }}>
          Pedidos360
        </div>
        <nav style={{ flex: 1, padding: '1rem' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li style={{ marginBottom: '1rem' }}>
              <Link to="/dashboard" style={{ textDecoration: 'none', color: location.pathname === '/dashboard' ? '#0070f3' : '#333', fontWeight: location.pathname === '/dashboard' ? 'bold' : 'normal' }}>Inicio</Link>
            </li>
            <li style={{ marginBottom: '1rem' }}>
              <Link to="/orders" style={{ textDecoration: 'none', color: location.pathname.startsWith('/orders') ? '#0070f3' : '#333', fontWeight: location.pathname.startsWith('/orders') ? 'bold' : 'normal' }}>Mis Pedidos</Link>
            </li>
            {isAdmin && (
              <li style={{ marginBottom: '1rem' }}>
                <Link to="/users" style={{ textDecoration: 'none', color: location.pathname === '/users' ? '#0070f3' : '#333' }}>Usuarios</Link>
              </li>
            )}
          </ul>
        </nav>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ height: '60px', backgroundColor: '#fff', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{title || 'Dashboard'}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span>Bienvenido, <b>{account?.name || account?.username}</b></span>
            <button className="btn" onClick={handleLogout}>Cerrar Sesin</button>
          </div>
        </header>

        <main style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
