import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRoles } from '../../hooks/useRoles';
import { useCatalog, useOrders } from '../../hooks/useData';
import { clp, longToday, fmtRelativeDay, fmtDate, orderId, orderTotal, sortByNewest } from '../../lib/format';
import { categoryLabel, isAvailable } from '../../lib/products';
import { getCart, setCart } from '../../lib/cart';
import { isMine } from '../../lib/ownOrders';
import { OrderProgress, OrderLines } from '../orders/OrderParts';
import { StatusBadge, ProductThumb, Alert, PageHead } from '../ui';
import { IconPlus, IconChevron, IconCheck } from '../Icons';

const FEATURED = ['PAN-003', 'PAS-003', 'CAF-003', 'BEB-002'];

export default function CustomerHome() {
  const { account, email } = useRoles();
  const { orders, loading, error } = useOrders();
  const { products, byId } = useCatalog();
  const [added, setAdded] = useState({});

  const mine = useMemo(
    () => sortByNewest(orders.filter((o) => isMine(o, email, orderId(o)))),
    [orders, email],
  );
  const active = mine.filter((o) => !['ENTREGADO', 'CANCELADO'].includes(o.status));
  const current = active[0];
  const notCancelled = mine.filter((o) => o.status !== 'CANCELADO');
  const delivered = mine.filter((o) => o.status === 'ENTREGADO');
  const lastDelivered = delivered[0];

  const recos = useMemo(() => {
    const available = products.filter(isAvailable);
    const featured = FEATURED.map((sku) => available.find((p) => p.sku === sku)).filter(Boolean);
    const rest = available.filter((p) => !featured.includes(p));
    return [...featured, ...rest].slice(0, 4);
  }, [products]);

  const addToCart = (p) => {
    const cart = getCart();
    cart[p.id] = Math.min((cart[p.id] || 0) + 1, Number(p.stock) || 1);
    setCart(cart);
    setAdded((prev) => ({ ...prev, [p.id]: true }));
  };

  const firstName = (account?.name || '').split(/\s+/)[0];
  const name = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() : '';

  return (
    <>
      <PageHead eyebrow={longToday()} title={name ? `Hola, ${name}` : 'Hola'}>
        <Link to="/catalog" className="btn primary"><IconPlus /> Nuevo pedido</Link>
      </PageHead>

      {error && <Alert>{error.message}</Alert>}

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">Pedidos en curso</div>
          <div className="kpi-value">{loading ? '—' : active.length}</div>
          <div className="kpi-foot">{active.filter((o) => o.status === 'CREADO').length} esperando confirmación</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total comprado</div>
          <div className="kpi-value">{loading ? '—' : clp(notCancelled.reduce((s, o) => s + orderTotal(o), 0))}</div>
          <div className="kpi-foot">{notCancelled.length} pedidos, sin contar cancelados</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Entregados</div>
          <div className="kpi-value">{loading ? '—' : delivered.length}</div>
          <div className="kpi-foot">{lastDelivered ? `Último el ${fmtDate(lastDelivered.deliveredAt || lastDelivered.updatedAt)}` : 'Aún sin entregas'}</div>
        </div>
      </div>

      <div className="row">
        <section className="card card-pad stack col-main" style={{ gap: 22 }}>
          {current ? (
            <>
              <div className="card-head" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div className="small" style={{ fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tu pedido en curso</div>
                  <h2 className="card-title" style={{ fontSize: 22, marginTop: 6 }}>Pedido #{orderId(current)}</h2>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {fmtRelativeDay(current.createdAt)}{current.deliveryAddress ? ` · ${current.deliveryAddress}` : ''}
                  </p>
                </div>
                <StatusBadge status={current.status} />
              </div>
              <OrderProgress order={current} />
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
                <OrderLines order={current} byId={byId} />
              </div>
              <Link to="/orders" state={{ select: orderId(current) }} className="card-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 44 }}>
                Ver detalle del pedido <IconChevron size={16} />
              </Link>
            </>
          ) : (
            <div className="empty" style={{ padding: '32px 12px' }}>
              <h2 className="card-title" style={{ marginBottom: 8 }}>No tienes pedidos en curso</h2>
              <p className="muted" style={{ margin: '0 0 16px' }}>Arma tu pedido desde el catálogo y síguelo aquí paso a paso.</p>
              <Link to="/catalog" className="btn primary">Ir al catálogo</Link>
            </div>
          )}
        </section>

        <section className="card card-pad col-side stack-sm">
          <div className="card-head">
            <h2 className="card-title">Últimos pedidos</h2>
            <Link to="/orders" className="card-link">Ver todos</Link>
          </div>
          {mine.slice(0, 4).map((o) => (
            <Link key={orderId(o)} to="/orders" state={{ select: orderId(o) }} className="list-row">
              <div>
                <div className="list-row-title">Pedido #{orderId(o)}</div>
                <div className="list-row-sub">{fmtRelativeDay(o.createdAt)} · {clp(orderTotal(o))}</div>
              </div>
              <StatusBadge status={o.status} />
            </Link>
          ))}
          {!loading && mine.length === 0 && <p className="muted">Todavía no has hecho pedidos.</p>}
        </section>
      </div>

      {recos.length > 0 && (
        <section className="stack">
          <div className="card-head">
            <h2 className="card-title">Recomendados para hoy</h2>
            <Link to="/catalog" className="card-link">Ver catálogo completo</Link>
          </div>
          <div className="prod-grid">
            {recos.map((p) => (
              <article key={p.id} className="prod-card">
                <div className="prod-img"><ProductThumb product={p} className="" size={44} /></div>
                <div className="prod-body">
                  <div className="prod-meta"><span>{categoryLabel(p.category)}</span></div>
                  <h3 className="prod-name">{p.name}</h3>
                  <div className="prod-foot">
                    <span className="price">{clp(p.price)}</span>
                    <button type="button" className="btn soft icon" style={{ width: 44, minHeight: 44 }} onClick={() => addToCart(p)} aria-label={`Agregar ${p.name} al pedido`}>
                      {added[p.id] ? <IconCheck size={16} /> : <IconPlus />}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
