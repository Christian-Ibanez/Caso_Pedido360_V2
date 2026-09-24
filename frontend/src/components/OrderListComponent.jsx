import { useState } from 'react';
import OrderStatusBadgeComponent from './OrderStatusBadgeComponent';
import { api } from '../api/http';

const BAKERY_PRODUCTS = [
  { id: 1, name: 'Croissant', price: 2.50 },
  { id: 2, name: 'Pan de Bono', price: 1.00 },
  { id: 3, name: 'Café Americano', price: 1.50 },
  { id: 4, name: 'Capuchino', price: 2.00 },
  { id: 5, name: 'Torta de Chocolate', price: 3.50 }
];

export default function OrderListComponent({ orders, loading, onSelectOrder, onRefresh, isAdmin, isOperator, isCustomer }) {
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState('');
  
  // New order state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState([]); // { product, quantity }

  const filteredOrders = orders.filter(order => 
    (order.id || order.orderId || '').toString().includes(filter) ||
    (order.status || '').toLowerCase().includes(filter.toLowerCase()) ||
    (order.customerName || order.description || '').toLowerCase().includes(filter.toLowerCase())
  );

  const handleAddItem = (productId) => {
    if (!productId) return;
    const product = BAKERY_PRODUCTS.find(p => p.id === parseInt(productId));
    if (!product) return;

    setSelectedItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleRemoveItem = (productId) => {
    setSelectedItems(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setCreationError('');
    if (selectedItems.length === 0) {
      setCreationError("Debes agregar al menos un producto al pedido.");
      return;
    }
    setCreating(true);
    try {
      const payload = {
        storeId: 1, // Default store for now
        customerName: customerName,
        customerEmail: customerEmail,
        deliveryAddress: deliveryAddress,
        notes: notes,
        items: selectedItems.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.product.price
        }))
      };

      await api.post('/api/orders', payload);
      
      // Reset form
      setCustomerName('');
      setCustomerEmail('');
      setDeliveryAddress('');
      setNotes('');
      setSelectedItems([]);
      setIsFormOpen(false);
      onRefresh();
    } catch (err) {
      setCreationError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const canCreate = isCustomer || isOperator;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <input 
          type="text" 
          placeholder="Filtrar pedidos..." 
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ padding: '0.5rem', width: '300px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button onClick={onRefresh} className="btn" disabled={loading}>
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>

      {canCreate && !isFormOpen && (
        <button className="btn primary" onClick={() => setIsFormOpen(true)} style={{ marginBottom: '2rem' }}>
          + Nuevo Pedido
        </button>
      )}

      {canCreate && isFormOpen && (
        <form onSubmit={handleCreateOrder} style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f9f9f9', border: '1px solid #eee', borderRadius: '8px' }}>
          <h3>Crear Nuevo Pedido (Panadería y Cafés)</h3>
          
          {creationError && (
            <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>
              {creationError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Nombre del Cliente</label>
              <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} required style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Email del Cliente</label>
              <input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} required style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Dirección de Entrega</label>
              <input type="text" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} required style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Notas adicionales</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <h4>Productos</h4>
            <select onChange={(e) => { handleAddItem(e.target.value); e.target.value = ''; }} style={{ padding: '0.5rem', marginBottom: '1rem', width: '100%' }}>
              <option value="">-- Seleccionar producto para agregar --</option>
              {BAKERY_PRODUCTS.map(p => (
                <option key={p.id} value={p.id}>{p.name} - ${p.price.toFixed(2)}</option>
              ))}
            </select>

            {selectedItems.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {selectedItems.map(item => (
                  <li key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#fff', border: '1px solid #ddd', marginBottom: '0.5rem', borderRadius: '4px' }}>
                    <span>{item.quantity}x {item.product.name}</span>
                    <span>
                      ${(item.quantity * item.product.price).toFixed(2)}
                      <button type="button" onClick={() => handleRemoveItem(item.product.id)} style={{ marginLeft: '1rem', color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>X</button>
                    </span>
                  </li>
                ))}
                <li style={{ textAlign: 'right', fontWeight: 'bold', padding: '0.5rem' }}>
                  Total: ${selectedItems.reduce((acc, item) => acc + (item.quantity * item.product.price), 0).toFixed(2)}
                </li>
              </ul>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="submit" className="btn primary" disabled={creating}>
              {creating ? 'Creando...' : 'Crear Pedido'}
            </button>
            <button type="button" className="btn" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading && orders.length === 0 ? (
        <p>Cargando pedidos...</p>
      ) : filteredOrders.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
          <thead>
            <tr style={{ backgroundColor: '#f4f4f4', borderBottom: '2px solid #ddd', textAlign: 'left' }}>
              <th style={{ padding: '1rem' }}>ID</th>
              <th style={{ padding: '1rem' }}>Cliente / Info</th>
              <th style={{ padding: '1rem' }}>Estado</th>
              <th style={{ padding: '1rem' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(order => (
              <tr key={order.id || order.orderId} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '1rem' }}>{order.id || order.orderId}</td>
                <td style={{ padding: '1rem' }}>
                  {order.customerName ? `Cliente: ${order.customerName}` : (order.description || 'Sin descripción')}
                </td>
                <td style={{ padding: '1rem' }}>
                  <OrderStatusBadgeComponent status={order.status || 'CREADO'} />
                </td>
                <td style={{ padding: '1rem' }}>
                  <button className="btn" onClick={() => onSelectOrder(order)}>Ver Detalle</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No se encontraron pedidos.</p>
      )}
    </div>
  );
}
