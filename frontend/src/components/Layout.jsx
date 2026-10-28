import { useEffect, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { NavLink } from 'react-router-dom';
import { useRoles, clearRolesCache } from '../hooks/useRoles';
import { api } from '../api/http';
import { clearCart } from '../lib/cart';
import { IconBag, IconHome, IconTag, IconChart, IconShield, IconLogout } from './Icons';

// Cantidad de pedidos por aceptar (insignia del menú para Admin/Operador).
let pendingCache = { value: null, at: 0 };
const listeners = new Set();

export function publishPendingCount(orders) {
  const value = (orders || []).filter((o) => o.status === 'CREADO').length;
  pendingCache = { value, at: Date.now() };
  listeners.forEach((fn) => fn(value));
}

function usePendingCount(enabled) {
  const [count, setCount] = useState(pendingCache.value);
  useEffect(() => {
    if (!enabled) return undefined;
    listeners.add(setCount);
    if (Date.now() - pendingCache.at > 30000) {
      api.get('/api/orders').then((data) => publishPendingCount(Array.isArray(data) ? data : [])).catch(() => {});
    }
    return () => listeners.delete(setCount);
  }, [enabled]);
  return count;
}

function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function titleCase(name) {
  return (name || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function Layout({ title, children }) {
  const { instance } = useMsal();
  const { account, email, isAdmin, isAuditor, isOperator, isStaff } = useRoles();
  const pending = usePendingCount(isStaff);

  useEffect(() => {
    document.title = title ? `${title} · Pedidos360` : 'Pedidos360';
  }, [title]);

  const handleLogout = () => {
    clearRolesCache();
    clearCart();
    instance.logoutRedirect({ postLogoutRedirectUri: `${window.location.origin}/login` });
  };

  const role = isAdmin
    ? { label: 'Admin', cls: 'admin', sub: 'Panel de administración' }
    : isOperator
      ? { label: 'Operador', cls: 'operator', sub: 'Panel de operación' }
      : isAuditor
        ? { label: 'Auditor', cls: 'auditor', sub: 'Panel de auditoría' }
        : { label: 'Cliente', cls: '', sub: 'Panadería y cafetería' };

  const displayName = titleCase(account?.name) || email || 'Usuario';
  const navClass = ({ isActive }) => (isActive ? 'active' : undefined);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark"><IconBag size={22} /></div>
            <div>
              <div className="brand-name">Pedidos360</div>
              <div className="brand-sub">{role.sub}</div>
            </div>
          </div>

          <nav className="nav" aria-label="Principal">
            <NavLink to="/dashboard" className={navClass}>
              <IconHome /> <span className="nav-label">Inicio</span>
            </NavLink>
            {!isAuditor || isStaff ? (
              <NavLink to="/orders" className={navClass}>
                <IconBag /> <span className="nav-label">{isStaff ? 'Pedidos' : 'Mis pedidos'}</span>
                {isStaff && pending > 0 && <span className="nav-badge" aria-label={`${pending} por aceptar`}>{pending}</span>}
              </NavLink>
            ) : null}
            <NavLink to="/catalog" className={navClass}>
              <IconTag /> <span className="nav-label">Catálogo</span>
            </NavLink>
            {isAdmin && (
              <NavLink to="/reports" className={navClass}>
                <IconChart /> <span className="nav-label">Reportería</span>
              </NavLink>
            )}
            {(isAdmin || isAuditor) && (
              <NavLink to="/audit" className={navClass}>
                <IconShield /> <span className="nav-label">Auditoría</span>
              </NavLink>
            )}
          </nav>
        </div>

        <div className="userbox">
          <div className="user">
            <div className="avatar" aria-hidden="true">{initials(account?.name || email)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="user-name">{displayName}</div>
              <div className="user-mail">{email}</div>
            </div>
          </div>
          <div className="user-actions">
            <span className={`role-chip ${role.cls}`}>{role.label}</span>
            <button type="button" className="btn-logout" onClick={handleLogout}>
              <IconLogout size={16} /> Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
