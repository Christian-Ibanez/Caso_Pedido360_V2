import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  subscribeNotifications, markRead, markAllRead, NEW_NOTIFICATIONS_EVENT,
} from '../lib/notifications';
import { fmtAgo } from '../lib/format';
import { IconBell, IconX } from './Icons';

const TOAST_MS = 7000;

/** Campana con la bandeja de notificaciones y avisos emergentes cuando llega una nueva. */
export default function NotificationBell() {
  const navigate = useNavigate();
  const [inbox, setInbox] = useState({ unread: 0, items: [], ready: false, unavailable: false });
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const wrapRef = useRef(null);

  useEffect(() => subscribeNotifications(setInbox), []);

  // Al cerrar la bandeja, lo que se alcanzó a ver queda como leído: el número de la campana desaparece.
  // Mientras está abierta se mantienen los puntos de "sin leer" para distinguir las nuevas.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      if (inbox.unread > 0) markAllRead();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onNew = (e) => {
      const fresh = (e.detail || []).slice(0, 3);
      setToasts((t) => [...fresh, ...t].slice(0, 3));
      fresh.forEach((n) => setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), TOAST_MS));
    };
    window.addEventListener(NEW_NOTIFICATIONS_EVENT, onNew);
    return () => window.removeEventListener(NEW_NOTIFICATIONS_EVENT, onNew);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (n) => {
    markRead(n.id);
    setOpen(false);
    setToasts((t) => t.filter((x) => x.id !== n.id));
    if (n.orderId) navigate('/orders', { state: { select: n.orderId } });
  };

  const label = inbox.unread > 0 ? `Notificaciones, ${inbox.unread} sin leer` : 'Notificaciones';

  return (
    <>
      <div className="bell-wrap" ref={wrapRef}>
        <button type="button" className="bell" aria-label={label} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
          <IconBell size={20} />
          {!open && inbox.unread > 0 && <span className="bell-badge" aria-hidden="true">{inbox.unread > 9 ? '9+' : inbox.unread}</span>}
        </button>

        {open && (
          <div className="bell-panel" role="dialog" aria-label="Notificaciones">
            <div className="bell-head">
              <b>Notificaciones</b>
              {inbox.unread > 0 && (
                <button type="button" className="btn ghost sm" onClick={markAllRead}>Marcar todas como leídas</button>
              )}
            </div>
            <div className="bell-list">
              {inbox.items.map((n) => (
                <button key={n.id} type="button" className={`bell-item ${n.read ? '' : 'unread'}`} onClick={() => go(n)}>
                  <span className="bell-dot" aria-hidden="true" />
                  <span className="bell-text">
                    <span className="bell-title">{n.title}</span>
                    {n.body && <span className="bell-body">{n.body}</span>}
                    <span className="bell-time">{fmtAgo(n.createdAt)}</span>
                  </span>
                </button>
              ))}
              {inbox.ready && !inbox.unavailable && inbox.items.length === 0 && (
                <p className="bell-empty">No tienes notificaciones todavía.</p>
              )}
              {inbox.unavailable && inbox.items.length === 0 && (
                <p className="bell-empty">No pudimos cargar las notificaciones en este momento.</p>
              )}
              {!inbox.ready && <p className="bell-empty">Cargando…</p>}
            </div>
          </div>
        )}
      </div>

      <div className="toasts" aria-live="polite">
        {toasts.map((n) => (
          <div key={n.id} className="toast">
            <button type="button" className="toast-main" onClick={() => go(n)}>
              <span className="toast-icon"><IconBell size={18} /></span>
              <span className="bell-text">
                <span className="bell-title">{n.title}</span>
                {n.body && <span className="bell-body">{n.body}</span>}
              </span>
            </button>
            <button type="button" className="toast-close" aria-label="Cerrar aviso" onClick={() => setToasts((t) => t.filter((x) => x.id !== n.id))}>
              <IconX size={14} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
