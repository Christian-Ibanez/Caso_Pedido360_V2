import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useCatalog } from '../../hooks/useData';
import { createCatalogProduct, updateCatalogProduct, deleteCatalogProduct } from '../../api/catalog';
import { clp } from '../../lib/format';
import { CATEGORIES, categoryKey, categoryLabel, LOW_STOCK, productImage, compareProducts } from '../../lib/products';
import { ProductThumb, Alert, PageHead } from '../ui';
import { IconEdit, IconPlus, IconSearch, IconTrash } from '../Icons';

const PER_PAGE = 10;
const EMPTY = { id: null, sku: '', name: '', category: 'Panaderia', price: '', stock: '', description: '', active: true };

function toDraft(p) {
  return {
    id: p.id,
    sku: p.sku || '',
    name: p.name || '',
    category: CATEGORIES.find((c) => categoryKey(c) === categoryKey(p.category)) || p.category || 'Panaderia',
    price: p.price ?? '',
    stock: p.stock ?? '',
    description: p.description || '',
    active: p.active !== false,
  };
}

export default function AdminCatalog() {
  const location = useLocation();
  const { products, setProducts, loading, error, reload } = useCatalog();
  const [cat, setCat] = useState('todas');
  const [q, setQ] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [rowError, setRowError] = useState('');
  const [pendingRow, setPendingRow] = useState({});
  const opened = useRef(false);
  const stockTimers = useRef({});

  // Abrir el panel si se llegó desde el inicio ("Reponer" o "Nuevo producto")
  useEffect(() => {
    if (opened.current || products.length === 0) return;
    const editId = location.state?.edit;
    if (editId != null) {
      const p = products.find((x) => x.id === editId);
      if (p) setDraft(toDraft(p));
      opened.current = true;
    } else if (location.state?.create) {
      setDraft({ ...EMPTY });
      opened.current = true;
    } else {
      setDraft(toDraft([...products].sort((a, b) => a.stock - b.stock)[0]));
      opened.current = true;
    }
  }, [products, location.state]);

  const term = q.trim().toLowerCase();
  const list = useMemo(() => products
    .filter((p) => cat === 'todas' || categoryKey(p.category) === cat)
    .filter((p) => !onlyLow || (Number(p.stock) || 0) <= LOW_STOCK)
    .filter((p) => !term || (p.name || '').toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term))
    .sort(compareProducts), [products, cat, onlyLow, term]);

  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const current = Math.min(page, pages);
  const slice = list.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const stats = {
    total: products.length,
    active: products.filter((p) => p.active !== false).length,
    low: products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK).length,
    out: products.filter((p) => (Number(p.stock) || 0) <= 0).length,
  };

  const cats = ['todas', ...CATEGORIES.map(categoryKey)];

  const patchLocal = (id, patch) => setProducts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  // Ajuste rápido de stock: se ve al instante y se guarda tras una pausa breve
  const adjustStock = (p, delta) => {
    const value = Math.max(0, (Number(p.stock) || 0) + delta);
    patchLocal(p.id, { stock: value });
    if (draft?.id === p.id) setDraft((d) => ({ ...d, stock: value }));
    clearTimeout(stockTimers.current[p.id]);
    stockTimers.current[p.id] = setTimeout(async () => {
      try {
        await updateCatalogProduct(p.id, { stock: value });
      } catch (err) {
        setRowError(`No se pudo guardar el stock de ${p.name}: ${err.message}`);
        reload();
      }
    }, 600);
  };

  const toggleActive = async (p) => {
    const value = p.active === false;
    setPendingRow((r) => ({ ...r, [p.id]: true }));
    patchLocal(p.id, { active: value });
    try {
      await updateCatalogProduct(p.id, { active: value });
    } catch (err) {
      patchLocal(p.id, { active: !value });
      setRowError(`No se pudo cambiar ${p.name}: ${err.message}`);
    } finally {
      setPendingRow((r) => ({ ...r, [p.id]: false }));
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`¿Eliminar "${p.name}" (${p.sku})? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteCatalogProduct(p.id);
      setProducts((ps) => ps.filter((x) => x.id !== p.id));
      if (draft?.id === p.id) setDraft(null);
      setNotice(`Eliminaste ${p.name}.`);
    } catch (err) {
      setRowError(`No se pudo eliminar ${p.name}: ${err.message}`);
    }
  };

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    const body = {
      name: draft.name.trim(),
      category: draft.category,
      price: Number(draft.price),
      stock: parseInt(draft.stock, 10),
      description: draft.description.trim() || null,
      active: draft.active,
    };
    try {
      if (draft.id == null) {
        const created = await createCatalogProduct({ ...body, sku: draft.sku.trim().toUpperCase() });
        setProducts((ps) => [...ps, created]);
        setDraft(toDraft(created));
        setNotice(`Creaste ${created.name}.`);
      } else {
        const updated = await updateCatalogProduct(draft.id, body);
        patchLocal(draft.id, updated || body);
        setNotice(`Guardaste los cambios de ${body.name}.`);
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const isNew = draft && draft.id == null;
  const start = list.length ? (current - 1) * PER_PAGE + 1 : 0;

  return (
    <>
      <PageHead title="Catálogo e inventario" subtitle="Administra productos, precios y stock.">
        <button type="button" className="btn primary" onClick={() => { setDraft({ ...EMPTY }); setFormError(''); }}>
          <IconPlus /> Nuevo producto
        </button>
      </PageHead>

      {error && <Alert>{error.message}</Alert>}
      <Alert onClose={() => setRowError('')}>{rowError}</Alert>
      <Alert kind="success" onClose={() => setNotice('')}>{notice}</Alert>

      <div className="kpis compact">
        <div className="kpi"><div className="kpi-label">Productos</div><div className="kpi-value">{stats.total}</div></div>
        <div className="kpi"><div className="kpi-label">Activos</div><div className="kpi-value">{stats.active}</div></div>
        <div className="kpi warn"><div className="kpi-label">Stock bajo (≤ {LOW_STOCK})</div><div className="kpi-value">{stats.low}</div></div>
        <div className="kpi"><div className="kpi-label">Agotados</div><div className="kpi-value">{stats.out}</div></div>
      </div>

      <div className="filters-row">
        <label className="search grow">
          <IconSearch />
          <input type="search" aria-label="Buscar productos" placeholder="Nombre o SKU" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </label>
        <div className="chips" role="group" aria-label="Categorías">
          {cats.map((c) => (
            <button key={c} type="button" aria-pressed={cat === c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => { setCat(c); setPage(1); }}>
              {c === 'todas' ? 'Todas' : categoryLabel(c)}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={onlyLow} onChange={(e) => { setOnlyLow(e.target.checked); setPage(1); }} />
          Solo stock bajo o agotado
        </label>
      </div>

      <div className="row top" style={{ gap: 20 }}>
        <section className="card col-main" style={{ overflow: 'hidden', flexBasis: 640 }}>
          <div className="table-wrap">
            <table className="tbl" style={{ minWidth: 760 }}>
              <thead>
                <tr><th>Producto</th><th>Categoría</th><th className="right">Precio</th><th>Stock</th><th>Activo</th><th><span className="sr-only">Acciones</span></th></tr>
              </thead>
              <tbody>
                {slice.map((p) => {
                  const stock = Number(p.stock) || 0;
                  const out = stock <= 0;
                  const low = !out && stock <= LOW_STOCK;
                  return (
                    <tr key={p.id} className={draft?.id === p.id ? 'selected' : ''}>
                      <td>
                        <div className="prod-cell">
                          <ProductThumb product={p} dim={p.active === false} />
                          <div style={{ minWidth: 0 }}>
                            <span className="cell-strong" style={{ display: 'block' }}>{p.name}</span>
                            <span className="cell-sub mono">{p.sku}</span>
                          </div>
                        </div>
                      </td>
                      <td className="muted">{categoryLabel(p.category)}</td>
                      <td className="right cell-strong num">{clp(p.price)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="qty neutral" role="group" aria-label={`Stock de ${p.name}`}>
                            <button type="button" onClick={() => adjustStock(p, -1)} disabled={out} aria-label="Restar stock">−</button>
                            <span style={{ color: out ? 'var(--danger)' : low ? 'var(--warn)' : undefined }}>{stock}</span>
                            <button type="button" onClick={() => adjustStock(p, 1)} aria-label="Sumar stock">+</button>
                          </div>
                          {(out || low) && <span className={`badge ${out ? 'out' : 'low'}`} style={{ fontSize: 11, padding: '2px 7px' }}>{out ? 'Agotado' : 'Bajo'}</span>}
                        </div>
                      </td>
                      <td>
                        <button type="button" role="switch" className="switch" aria-checked={p.active !== false} aria-label={`${p.name} activo`} disabled={pendingRow[p.id]} onClick={() => toggleActive(p)} />
                      </td>
                      <td>
                        <div className="actions" style={{ gap: 6, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                          <button type="button" className="btn icon" onClick={() => { setDraft(toDraft(p)); setFormError(''); }} aria-label={`Editar ${p.name}`}><IconEdit size={16} /></button>
                          <button type="button" className="btn icon danger" onClick={() => remove(p)} aria-label={`Eliminar ${p.name}`}><IconTrash size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {loading && products.length === 0 && <div className="loading">Cargando catálogo…</div>}
          {!loading && list.length === 0 && <div className="empty">No hay productos con este filtro.</div>}
          <div className="pagination">
            <span>Mostrando {start}–{Math.min(current * PER_PAGE, list.length)} de {list.length} productos</span>
            <div className="pages">
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" className={`page-btn ${n === current ? 'active' : ''}`} aria-current={n === current ? 'page' : undefined} onClick={() => setPage(n)}>{n}</button>
              ))}
            </div>
          </div>
        </section>

        {draft && (
          <aside className="card col-side" style={{ overflow: 'hidden', flexBasis: 320 }} aria-label={isNew ? 'Nuevo producto' : 'Editar producto'}>
            <div className="panel-media">
              {productImage(draft) ? <img src={productImage(draft)} alt={draft.name} /> : <ProductThumb product={draft} className="" size={44} />}
            </div>
            <form className="panel" style={{ gap: 14 }} onSubmit={save}>
              <div className="card-head">
                <h2 className="card-title">{isNew ? 'Nuevo producto' : 'Editar producto'}</h2>
                {!isNew && <span className="subtle small mono">{draft.sku}</span>}
              </div>
              <Alert onClose={() => setFormError('')}>{formError}</Alert>
              {isNew && (
                <label className="field">SKU
                  <input value={draft.sku} onChange={set('sku')} placeholder="Ej: PAN-009" required maxLength={40} />
                </label>
              )}
              <label className="field">Nombre
                <input value={draft.name} onChange={set('name')} required maxLength={120} />
              </label>
              <label className="field">Categoría
                <select value={draft.category} onChange={set('category')}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                </select>
              </label>
              <div className="form-grid two">
                <label className="field">Precio (CLP)
                  <input type="number" min="0" step="10" value={draft.price} onChange={set('price')} required />
                </label>
                <label className="field">Stock
                  <input type="number" min="0" step="1" value={draft.stock} onChange={set('stock')} required />
                </label>
              </div>
              <label className="field">Descripción
                <textarea rows={3} value={draft.description} onChange={set('description')} placeholder="Opcional" maxLength={500} />
              </label>
              <label className="check" style={{ minHeight: 32 }}>
                <input type="checkbox" checked={draft.active} onChange={set('active')} />
                Visible en el catálogo
              </label>
              <div className="actions">
                <button type="submit" className="btn primary" style={{ flex: 1 }} disabled={saving}>
                  {saving ? 'Guardando…' : isNew ? 'Crear producto' : 'Guardar cambios'}
                </button>
                <button type="button" className="btn" onClick={() => setDraft(null)}>Cerrar</button>
              </div>
            </form>
          </aside>
        )}
      </div>
    </>
  );
}
