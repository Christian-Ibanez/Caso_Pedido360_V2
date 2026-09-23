import { useState, useEffect } from 'react';
import OrderStatusBadgeComponent from './OrderStatusBadgeComponent';
import { request } from '../api/http';

export default function OrderDetailComponent({ orderId, isAdmin, isOperator, isCustomer, onBack }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const data = await request(`/api/orders/${orderId}`);
        setOrder(data);
        setNewStatus(data.status || 'CREATED');
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
    try {
      await request(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        body: { status: newStatus }
      });
      setOrder({ ...order, status: newStatus });
      alert('Estado actualizado correctamente.');
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const canChangeStatus = isAdmin || isOperator;

  if (loading) return <p>Cargando detalle del pedido...</p>;
  if (error) return (
    <div>
      <p style={{ color: 'red' }}>{error}</p>
      <button className="btn" onClick={onBack}>Volver</button>
    </div>
  );
  if (!order) return <p>Pedido no encontrado.</p>;

  return (
    <div>
      <button className="btn" onClick={onBack} style={{ marginBottom: '1rem' }}>&larr; Volver a la lista</button>
      
      <div style={{ padding: '2rem', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>Pedido #{order.id || order.orderId}</h2>
        <div style={{ margin: '1rem 0' }}>
          <strong>Estado actual: </strong>
          <OrderStatusBadgeComponent status={order.status || 'CREATED'} />
        </div>
        
        <div style={{ margin: '1rem 0' }}>
          <strong>Descripcin: </strong>
          <p>{order.description || 'Sin descripcin'}</p>
        </div>

        {canChangeStatus && (
          <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <h3>Cambiar Estado</h3>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <select 
                value={newStatus} 
                onChange={(e) => setNewStatus(e.target.value)}
                style={{ padding: '0.5rem' }}
              >
                <option value="CREATED">CREATED</option>
                <option value="PENDING">PENDING</option>
                <option value="ACCEPTED">ACCEPTED</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="SHIPPED">SHIPPED</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED</option>
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
