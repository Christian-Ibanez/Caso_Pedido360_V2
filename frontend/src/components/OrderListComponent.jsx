import { useState } from 'react';
import OrderStatusBadgeComponent from './OrderStatusBadgeComponent';
import { request } from '../api/http';

export default function OrderListComponent({ orders, loading, onSelectOrder, onRefresh, isAdmin, isOperator, isCustomer }) {
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [newOrderDesc, setNewOrderDesc] = useState('');

  const filteredOrders = orders.filter(order => 
    (order.id || order.orderId || '').toString().includes(filter) ||
    (order.status || '').toLowerCase().includes(filter.toLowerCase()) ||
    (order.description || '').toLowerCase().includes(filter.toLowerCase())
  );

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await request('/api/orders', {
        method: 'POST',
        body: {
          description: newOrderDesc,
          // other default fields...
        }
      });
      setNewOrderDesc('');
      onRefresh();
    } catch (err) {
      alert(err.message);
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

      {canCreate && (
        <form onSubmit={handleCreateOrder} style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f9f9f9', border: '1px solid #eee', borderRadius: '8px' }}>
          <h3>Crear Nuevo Pedido</h3>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Descripcin del pedido" 
              value={newOrderDesc}
              onChange={(e) => setNewOrderDesc(e.target.value)}
              style={{ padding: '0.5rem', flex: 1 }}
              required
            />
            <button type="submit" className="btn primary" disabled={creating || !newOrderDesc}>
              {creating ? 'Creando...' : 'Crear Pedido'}
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
              <th style={{ padding: '1rem' }}>Descripcin</th>
              <th style={{ padding: '1rem' }}>Estado</th>
              <th style={{ padding: '1rem' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(order => (
              <tr key={order.id || order.orderId} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '1rem' }}>{order.id || order.orderId}</td>
                <td style={{ padding: '1rem' }}>{order.description || 'Sin descripcin'}</td>
                <td style={{ padding: '1rem' }}>
                  <OrderStatusBadgeComponent status={order.status || 'CREATED'} />
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
