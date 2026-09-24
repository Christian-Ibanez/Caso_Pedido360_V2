import { useState, useEffect } from 'react';
import OrderStatusBadgeComponent from './OrderStatusBadgeComponent';
import { api } from '../api/http';

const BAKERY_PRODUCTS = [
  { id: 1, name: 'Croissant', price: 2.50 },
  { id: 2, name: 'Pan de Bono', price: 1.00 },
  { id: 3, name: 'Café Americano', price: 1.50 },
  { id: 4, name: 'Capuchino', price: 2.00 },
  { id: 5, name: 'Torta de Chocolate', price: 3.50 }
];

export default function OrderDetailComponent({ orderId, isAdmin, isOperator, isCustomer, onBack }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const data = await api.get(`/api/orders/${orderId}`);
        setOrder(data);
        setNewStatus(data.status || 'CREADO');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  const handleStatusChange = async () => {
    setUpdating(true);
    setUpdateError('');
    try {
      await api.put(`/api/orders/${orderId}/status`, { status: newStatus });
      setOrder({ ...order, status: newStatus });
      alert('Estado actualizado correctamente.');
    } catch (err) {
      setUpdateError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const getProductName = (id) => {
    const p = BAKERY_PRODUCTS.find(p => p.id === id);
    return p ? p.name : `Producto #${id}`;
  };

  const canChangeStatus = isAdmin || isOperator;

  if (loading) return <p>Cargando detalle del pedido...</p>;
  if (error) return (
    <div>
      <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
        <strong>Error:</strong> {error}
      </div>
      <button className="btn" onClick={onBack}>Volver</button>
    </div>
  );
  if (!order) return <p>Pedido no encontrado.</p>;

  return (
    <div>
      <button className="btn" onClick={onBack} style={{ marginBottom: '1rem' }}>&larr; Volver a la lista</button>
      
      <div style={{ padding: '2rem', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>Pedido #{order.id || order.orderId}</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
          <div>
            <h3>Detalles del Cliente</h3>
            <p><strong>Nombre:</strong> {order.customerName}</p>
            <p><strong>Email:</strong> {order.customerEmail}</p>
            <p><strong>Dirección:</strong> {order.deliveryAddress}</p>
            <p><strong>Notas:</strong> {order.notes || 'Ninguna'}</p>
            
            <div style={{ margin: '1.5rem 0' }}>
              <strong>Estado actual: </strong>
              <OrderStatusBadgeComponent status={order.status || 'CREADO'} />
            </div>
          </div>
          
          <div>
            <h3>Productos Solicitados</h3>
            {order.items && order.items.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                    <th>Producto</th>
                    <th>Cant.</th>
                    <th>Precio U.</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.5rem 0' }}>{getProductName(item.productId)}</td>
                      <td style={{ padding: '0.5rem 0' }}>{item.quantity}</td>
                      <td style={{ padding: '0.5rem 0' }}>${item.unitPrice.toFixed(2)}</td>
                      <td style={{ padding: '0.5rem 0' }}>${item.subtotal ? item.subtotal.toFixed(2) : (item.quantity * item.unitPrice).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold', padding: '1rem 0' }}>Total:</td>
                    <td style={{ fontWeight: 'bold', padding: '1rem 0' }}>${order.total ? order.total.toFixed(2) : '0.00'}</td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <p>{order.description || 'Sin productos'}</p>
            )}
          </div>
        </div>

        {canChangeStatus && (
          <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <h3>Cambiar Estado</h3>
            {updateError && (
              <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>
                {updateError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <select 
                value={newStatus} 
                onChange={(e) => setNewStatus(e.target.value)}
                style={{ padding: '0.5rem' }}
              >
                <option value="CREADO">CREADO</option>
                <option value="ACEPTADO">ACEPTADO</option>
                <option value="EN_PREPARACION">EN_PREPARACION</option>
                <option value="DESPACHADO">DESPACHADO</option>
                <option value="ENTREGADO">ENTREGADO</option>
                <option value="CANCELADO">CANCELADO</option>
              </select>
              <button 
                className="btn primary" 
                onClick={handleStatusChange}
                disabled={updating || newStatus === order.status}
              >
                {updating ? 'Actualizando...' : 'Actualizar Estado'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
