import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoles } from '../../hooks/useRoles';
import { useCatalog } from '../../hooks/useData';
import { clp } from '../../lib/format';
import { CATEGORIES, categoryKey, categoryLabel, stockState, compareProducts } from '../../lib/products';
import { getCart, setCart } from '../../lib/cart';
import { ProductThumb, Alert, PageHead } from '../ui';
import { IconBag, IconMinus, IconPlus, IconSearch } from '../Icons';

export default function CustomerCatalog() {
  const navigate = useNavigate();
  const { isAuditor, isStaff } = useRoles();
  const canOrder = !isAuditor || isStaff;
  const { products, loading, error } = useCatalog();
  const [cat, setCat] = useState('todas');
  const [q, setQ] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [cart, setLocalCart] = useState(() => getCart());

  const cats = useMemo(() => {
    const keys = new Set(CATEGORIES.map(categoryKey));
    products.forEach((p) => p.category && keys.add(categoryKey(p.category)));
    return ['todas', ...keys].map((k) => ({
      key: k,
      label: k === 'todas' ? 'Todas' : categoryLabel(k),
      count: k === 'todas' ? products.length : products.filter((p) => categoryKey(p.category) === k).length,
    })).filter((c) => c.key === 'todas' || c.count > 0);
  }, [products]);

  const term = q.trim().toLowerCase();
  const list = products
    .filter((p) => cat === 'todas' || categoryKey(p.category) === cat)
    .filter((p) => !onlyAvailable || stockState(p) !== 'out')
    .filter((p) => !term || (p.name || '').toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term))
    .sort(compareProducts);

  const change = (p, delta) => {
    const max = Number(p.stock) || 0;
    const next = { ...cart, [p.id]: Math.max(0, Math.min((cart[p.id] || 0) + delta, max)) };
    setLocalCart(setCart(next));
  };

  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  const cartItems = Object.entries(cart).filter(([id]) => byId[id]);
  const cartCount = cartItems.reduce((s, [, n]) => s + n, 0);
  const cartTotal = cartItems.reduce((s, [id, n]) => s + n * Number(byId[id].price || 0), 0);

  return (
    <>
      <PageHead title="Catálogo" subtitle={`${products.length} productos de panadería, pastelería, cafetería y más.`}>
        {canOrder && (
          <button type="button" className="cartbar" onClick={() => navigate('/orders', { state: { newOrder: true } })}>
            <IconBag style={{ color: '#fb923c' }} />
            <span>Tu pedido: {cartCount} {cartCount === 1 ? 'producto' : 'productos'} · <span className="num">{clp(cartTotal)}</span></span>
            <span className="go">Continuar</span>
          </button>
        )}
      </PageHead>

      {error && <Alert>{error.message}</Alert>}

      <div className="card filters-card">
        <div className="filters-row">
          <label className="search grow">
            <IconSearch />
            <input type="search" aria-label="Buscar productos" placeholder="Buscar por nombre o SKU (ej. PAN-001)" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
            Solo disponibles
          </label>
        </div>
        <div className="chips" role="group" aria-label="Categorías">
          {cats.map((c) => (
            <button key={c.key} type="button" aria-pressed={cat === c.key} className={`chip ${cat === c.key ? 'active' : ''}`} onClick={() => setCat(c.key)}>
              {c.label} <span className="chip-count">{c.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="muted">Mostrando <b style={{ color: 'var(--ink)' }}>{list.length}</b> productos</div>

      {loading && products.length === 0 && <div className="loading">Cargando catálogo…</div>}

      <div className="prod-grid">
        {list.map((p) => {
          const st = stockState(p);
          const qty = cart[p.id] || 0;
          return (
            <article key={p.id} className={`prod-card ${st === 'out' ? 'off' : ''}`}>
              <div className="prod-img">
                <ProductThumb product={p} className="" size={48} />
                <span className={`badge ${st === 'out' ? 'off' : st === 'low' ? 'low' : 'ok'}`}>
                  {st === 'out' ? 'No disponible' : st === 'low' ? `Quedan ${p.stock}` : 'Disponible'}
                </span>
              </div>
              <div className="prod-body">
                <div className="prod-meta"><span>{categoryLabel(p.category)}</span><span className="mono">{p.sku}</span></div>
                <h2 className="prod-name">{p.name}</h2>
                {p.description && <p className="subtle small" style={{ margin: 0 }}>{p.description}</p>}
                <div className="prod-foot">
                  <span className="price">{clp(p.price)}</span>
                  {canOrder && (st === 'out' ? (
                    <button type="button" className="btn sm" disabled>Agotado</button>
                  ) : qty > 0 ? (
                    <div className="qty" role="group" aria-label={`Cantidad de ${p.name}`}>
                      <button type="button" onClick={() => change(p, -1)} aria-label={`Quitar un ${p.name}`}><IconMinus size={16} /></button>
                      <span aria-live="polite">{qty}</span>
                      <button type="button" className="plus" onClick={() => change(p, 1)} disabled={qty >= (Number(p.stock) || 0)} aria-label={`Agregar otro ${p.name}`}><IconPlus size={16} /></button>
                    </div>
                  ) : (
                    <button type="button" className="btn soft sm" style={{ minHeight: 44 }} onClick={() => change(p, 1)} aria-label={`Agregar ${p.name} al pedido`}>
                      <IconPlus size={16} /> Agregar
                    </button>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!loading && list.length === 0 && <div className="card empty">No encontramos productos con ese filtro.</div>}
    </>
  );
}
