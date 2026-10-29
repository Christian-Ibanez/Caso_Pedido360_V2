import { useMemo, useState } from 'react';
import { api } from '../../api/http';
import { REGIONES_CHILE } from '../../data/chile';
import { clp } from '../../lib/format';
import { categoryLabel, isAvailable } from '../../lib/products';
import { getCart, setCart, clearCart } from '../../lib/cart';
import { ProductThumb, Alert } from '../ui';
import { IconMinus, IconPlus, IconTrash } from '../Icons';

/**
 * Formulario de nuevo pedido. Parte con lo que el cliente dejó en el carrito del catálogo.
 * El correo parte con el de la cuenta, pero se puede cambiar (por ejemplo, para probar el manejo de errores de
 * RabbitMQ con cliente@fail.test, @retry.test o @down.test). Si lockEmail es true queda fijo.
 */
export default function NewOrderForm({ products, byId, defaultName, defaultEmail, lockEmail, onCancel, onCreated }) {
  const [cart, setLocalCart] = useState(() => getCart());
  const [customerName, setCustomerName] = useState(defaultName || '');
  const [customerEmail, setCustomerEmail] = useState(defaultEmail || '');
  const [region, setRegion] = useState('');
  const [comuna, setComuna] = useState('');
  const [street, setStreet] = useState('');
  const [notes, setNotes] = useState('');
  const [picker, setPicker] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const comunas = REGIONES_CHILE.find((r) => r.region === region)?.comunas || [];
  const available = useMemo(() => products.filter(isAvailable), [products]);

  const items = Object.entries(cart)
    .map(([id, qty]) => ({ product: byId[id], qty }))
    .filter((i) => i.product);
  const total = items.reduce((s, i) => s + i.qty * Number(i.product.price || 0), 0);

  const update = (id, qty) => {
    const p = byId[id];
    const max = Number(p?.stock) || 0;
    const next = { ...cart, [id]: Math.max(0, Math.min(qty, max)) };
    setLocalCart(setCart(next));
  };

  const addFromPicker = (id) => {
    if (!id) return;
    update(id, (cart[id] || 0) + 1);
    setPicker('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (items.length === 0) {
      setError('Agrega al menos un producto al pedido.');
      return;
    }
    setSaving(true);
    try {
      const created = await api.post('/api/orders', {
        storeId: 1,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        deliveryAddress: `${street.trim()}, ${comuna}, ${region}`,
        notes: notes.trim() || null,
        items: items.map((i) => ({ productId: i.product.id, quantity: i.qty, unitPrice: i.product.price })),
      });
      clearCart();
      onCreated?.(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card card-pad stack" onSubmit={submit} style={{ gap: 20 }}>
      <div className="card-head">
        <h2 className="card-title">Nuevo pedido</h2>
        <span className="muted small">Panadería, pastelería y cafetería</span>
      </div>

      <Alert onClose={() => setError('')}>{error}</Alert>

      <div className="row top" style={{ gap: 24 }}>
        <div className="col-main stack">
          <h3 className="section-label">Productos</h3>
          {items.length === 0 && <p className="muted" style={{ margin: 0 }}>Tu pedido está vacío. Agrega productos desde el catálogo o con el buscador de abajo.</p>}
          {items.map(({ product: p, qty }) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <ProductThumb product={p} className="thumb" />
              <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div className="subtle small">{categoryLabel(p.category)} · {clp(p.price)} c/u</div>
              </div>
              <div className="qty" role="group" aria-label={`Cantidad de ${p.name}`}>
                <button type="button" onClick={() => update(p.id, qty - 1)} aria-label={`Quitar un ${p.name}`}><IconMinus size={16} /></button>
                <span aria-live="polite">{qty}</span>
                <button type="button" className="plus" onClick={() => update(p.id, qty + 1)} disabled={qty >= (Number(p.stock) || 0)} aria-label={`Agregar otro ${p.name}`}><IconPlus size={16} /></button>
              </div>
              <b className="num" style={{ width: 80, textAlign: 'right' }}>{clp(qty * Number(p.price || 0))}</b>
              <button type="button" className="btn icon danger" onClick={() => update(p.id, 0)} aria-label={`Quitar ${p.name} del pedido`}><IconTrash size={16} /></button>
            </div>
          ))}
          <label className="field">
            Agregar producto
            <select value={picker} onChange={(e) => addFromPicker(e.target.value)}>
              <option value="">Selecciona un producto del catálogo…</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {clp(p.price)} (stock {p.stock})</option>
              ))}
            </select>
          </label>
          <div className="line total" style={{ fontSize: 16 }}>
            <span>Total</span>
            <span className="num">{clp(total)}</span>
          </div>
        </div>

        <div className="col-side stack">
          <h3 className="section-label">Datos de entrega</h3>
          <label className="field">Nombre
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
          </label>
          <label className="field">Correo
            <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} readOnly={lockEmail} required />
            {!lockEmail && customerEmail.trim().toLowerCase() !== (defaultEmail || '').toLowerCase() && (
              <span className="muted" style={{ fontSize: 12 }}>
                El aviso y la boleta irán a este correo. Para probar errores: @fail.test, @retry.test o @down.test.
              </span>
            )}
          </label>
          <div className="form-grid two">
            <label className="field">Región
              <select value={region} onChange={(e) => { setRegion(e.target.value); setComuna(''); }} required>
                <option value="">Selecciona…</option>
                {REGIONES_CHILE.map((r) => <option key={r.region} value={r.region}>{r.region}</option>)}
              </select>
            </label>
            <label className="field">Comuna
              <select value={comuna} onChange={(e) => setComuna(e.target.value)} required disabled={!region}>
                <option value="">Selecciona…</option>
                {comunas.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <label className="field">Calle y número
            <input value={street} onChange={(e) => setStreet(e.target.value)} required />
          </label>
          <label className="field">Notas (opcional)
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: tocar el timbre 2 veces" />
          </label>
        </div>
      </div>

      <div className="actions" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Enviando…' : `Confirmar pedido · ${clp(total)}`}</button>
      </div>
    </form>
  );
}
