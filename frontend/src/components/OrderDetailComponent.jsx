import { useState, useEffect } from 'react';
import OrderStatusBadgeComponent from './OrderStatusBadgeComponent';
import { api } from '../api/http';
import { getCatalogProducts } from '../api/catalog';
import { getOrderTimeline } from '../api/audit';

export default function OrderDetailComponent({ orderId, isAdmin, isOperator, isCustomer, onBack }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [updateError, setUpdateError] = useState('');
  
  // Catálogo para nombres reales de productos
  const [catalogMap, setCatalogMap] = useState({});

  // Auditoría (ms-pedidos360-audit)
  const [timeline, setTimeline] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [timelineError, setTimelineError] = useState('');

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

  const fetchCatalog = async () => {
    try {
      const prods = await getCatalogProducts();
      if (Array.isArray(prods)) {
        const map = {};
        prods.forEach(p => { map[p.id] = p; });
        setCatalogMap(map);
      }
    } catch (e) {
      console.warn('No se pudo cargar catálogo para el detalle:', e);
    }
  };

  const fetchTimeline = async () => {
    setLoadingTimeline(true);
    setTimelineError('');
    try {
      const events = await getOrderTimeline(orderId);
      setTimeline(Array.isArray(events) ? events : []);
    } catch (e) {
      // Si el microservicio de auditoría no está corriendo (ej. sin Kafka), mostramos un aviso no bloqueante
      setTimelineError('Trazabilidad no disponible (el microservicio ms-pedidos360-audit no responde).');
      setTimeline([]);
    } finally {
      setLoadingTimeline(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    fetchCatalog();
    fetchTimeline();
  }, [orderId]);

  const handleStatusChange = async () => {
    setUpdating(true);
    setUpdateError('');
    try {
      await api.put(`/api/orders/${orderId}/status`, { status: newStatus });
      setOrder(prev => ({ ...prev, status: newStatus }));
      fetchTimeline(); // Refrescar la auditoría tras el cambio
      alert('Estado actualizado correctamente.');
    } catch (err) {
      setUpdateError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const getProductName = (id) => {
    const item = catalogMap[id];
    if (item) {
      return item.sku ? `[${item.sku}] ${item.name}` : item.name;
    }
    return `Producto #${id}`;
  };

  const formatPrice = (val) => {
    return `$${Number(val || 0).toLocaleString('es-CL')}`;
  };

  const canChangeStatus = isAdmin || isOperator;

  if (loading) return <p style={{ padding: '2rem' }}>Cargando detalle del pedido #{orderId}...</p>;
  if (error) return (
    <div>
      <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
        <strong>Error:</strong> {error}
      </div>
      <button className="btn" onClick={onBack}>Volver</button>
    </div>
  );
  if (!order) return <p>Pedido no encontrado.</p>;

  // Notificaciones según estado actual
  const currentStatus = order.status || 'CREADO';
  const hasKitchenTicket = ['ACEPTADO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO'].includes(currentStatus);
  const hasInvoice = currentStatus === 'ENTREGADO';
  const isCancelled = currentStatus === 'CANCELADO';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <button className="btn" onClick={onBack}>&larr; Volver a la lista de pedidos</button>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
          ID Interno: <code>{order.id || order.orderId}</code>
        </span>
      </div>

      <div style={{ padding: '2rem', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
        {/* Cabecera del pedido */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e5e7eb', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.5rem', color: '#111827' }}>Pedido #{order.id || order.orderId}</h2>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Registrado el: {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <OrderStatusBadgeComponent status={currentStatus} />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#111827' }}>
              Total: {formatPrice(order.total)}
            </div>
          </div>
        </div>

        {/* Sección 1: Cliente y Productos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
          <div>
            <h3 style={{ borderBottom: '2px solid #f3f4f6', paddingBottom: '0.5rem', marginTop: 0, color: '#1f2937' }}>
              Datos del Cliente y Despacho
            </h3>
            <p><strong>Nombre:</strong> {order.customerName}</p>
            <p><strong>Email:</strong> {order.customerEmail}</p>
            <p><strong>Dirección de Entrega:</strong> {order.deliveryAddress}</p>
            <p><strong>Notas:</strong> {order.notes || 'Ninguna observación especial'}</p>
            <p><strong>Tienda / Sucursal ID:</strong> {order.storeId || 1}</p>
          </div>

          <div>
            <h3 style={{ borderBottom: '2px solid #f3f4f6', paddingBottom: '0.5rem', marginTop: 0, color: '#1f2937' }}>
              Productos Solicitados (Catálogo)
            </h3>
            {order.items && order.items.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left', fontSize: '0.85rem', color: '#4b5563' }}>
                    <th style={{ padding: '0.5rem 0' }}>Ítem</th>
                    <th style={{ padding: '0.5rem 0', textAlign: 'center' }}>Cant.</th>
                    <th style={{ padding: '0.5rem 0', textAlign: 'right' }}>Precio U.</th>
                    <th style={{ padding: '0.5rem 0', textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.6rem 0', fontWeight: '500', color: '#111827' }}>
                        {getProductName(item.productId)}
                      </td>
                      <td style={{ padding: '0.6rem 0', textAlign: 'center', color: '#374151' }}>
                        {item.quantity}
                      </td>
                      <td style={{ padding: '0.6rem 0', textAlign: 'right', color: '#374151' }}>
                        {formatPrice(item.unitPrice)}
                      </td>
                      <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: '600', color: '#111827' }}>
                        {formatPrice(item.subtotal || (item.quantity * item.unitPrice))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold', padding: '1rem 0' }}>Total General:</td>
                    <td style={{ textAlign: 'right', fontWeight: '800', padding: '1rem 0', fontSize: '1.1rem', color: '#111827' }}>
                      {formatPrice(order.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <p style={{ color: '#6b7280' }}>{order.description || 'Sin detalle de productos'}</p>
            )}
          </div>
        </div>

        {/* Sección 2: Notificaciones Asíncronas (ms-pedidos360-notify vía RabbitMQ) */}
        <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.2rem' }}>📨</span>
            <h4 style={{ margin: 0, color: '#1e293b' }}>
              Eventos y Notificaciones Asíncronas (<code>ms-pedidos360-notify</code> vía RabbitMQ)
            </h4>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 1rem' }}>
            Este microservicio escucha comandos en RabbitMQ desencadenados por cambios de estado del pedido:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            
            <div style={{ backgroundColor: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#1e293b' }}>📧 Email / Webpush</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>Cola: <code>q.cmd.email</code></div>
              <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', fontWeight: '600', color: isCancelled ? '#dc2626' : '#16a34a' }}>
                {isCancelled ? '✓ Enviado (Prioridad Alta Cancelación)' : '✓ Notificación de Estado Enviada'}
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#1e293b' }}>🍳 Ticket de Cocina</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>Cola: <code>q.cmd.kitchen</code></div>
              <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', fontWeight: '600', color: hasKitchenTicket ? '#2563eb' : '#94a3b8' }}>
                {hasKitchenTicket ? '✓ Comanda Impresa / Generada' : '○ Pendiente (esperando estado ACEPTADO)'}
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#1e293b' }}>🧾 Boleta Electrónica</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>Cola: <code>q.cmd.invoice</code></div>
              <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', fontWeight: '600', color: hasInvoice ? '#16a34a' : '#94a3b8' }}>
                {hasInvoice ? '✓ Boleta PDF Emitida con Éxito' : '○ Pendiente (se emite al ENTREGAR)'}
              </div>
            </div>

          </div>
        </div>

        {/* Sección 3: Historial de Auditoría y Trazabilidad (ms-pedidos360-audit) */}
        <div style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0, color: '#1e293b' }}>
              🛡️ Línea de Tiempo de Auditoría (<code>ms-pedidos360-audit</code>)
            </h4>
            <button onClick={fetchTimeline} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', background: '#f8fafc' }}>
              ↻ Refrescar Timeline
            </button>
          </div>

          {loadingTimeline ? (
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Cargando bitácora de eventos del pedido...</p>
          ) : timelineError ? (
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>{timelineError}</p>
          ) : timeline.length > 0 ? (
            <div style={{ borderLeft: '3px solid #3b82f6', marginLeft: '0.5rem', paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {timeline.map((ev, i) => (
                <div key={ev.id || i} style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '-1.45rem', top: '0.25rem', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b' }}>
                    {ev.eventType}
                    {ev.newStatus && <span style={{ marginLeft: '0.5rem', color: '#2563eb' }}>({ev.previousStatus ? `${ev.previousStatus} → ` : ''}{ev.newStatus})</span>}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Por: <strong>{ev.actor || 'sistema'}</strong> {ev.origin ? `[IP: ${ev.origin}]` : ''} — {ev.occurredAt ? new Date(ev.occurredAt).toLocaleString() : ''}
                  </div>
                  {ev.summary && <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.2rem' }}>{ev.summary}</div>}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>
              No se han registrado eventos adicionales para este pedido en el microservicio de auditoría.
            </p>
          )}
        </div>

        {/* Sección 4: Acción de Cambiar Estado (Admin u Operador) */}
        {canChangeStatus && (
          <div style={{ padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h4 style={{ margin: '0 0 0.5rem', color: '#111827' }}>Actualizar Estado del Pedido</h4>
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#4b5563' }}>
              Al aceptar el pedido, se descontará automáticamente el stock en <code>ms-pedidos360-catalog</code> y se enviará la comanda a cocina vía <code>RabbitMQ</code>.
            </p>
            
            {updateError && (
              <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', border: '1px solid #f87171' }}>
                {updateError}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select 
                value={newStatus} 
                onChange={(e) => setNewStatus(e.target.value)}
                style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #d1d5db', fontWeight: '600' }}
              >
                <option value="CREADO">CREADO</option>
                <option value="ACEPTADO">ACEPTADO (Descuenta Stock y manda a cocina)</option>
                <option value="EN_PREPARACION">EN PREPARACIÓN</option>
                <option value="DESPACHADO">DESPACHADO</option>
                <option value="ENTREGADO">ENTREGADO (Genera Boleta PDF)</option>
                <option value="CANCELADO">CANCELADO (Repone Stock)</option>
              </select>
              <button 
                className="btn primary" 
                onClick={handleStatusChange}
                disabled={updating || newStatus === order.status}
              >
                {updating ? 'Guardando en ms-pedidos360-orders...' : 'Guardar Estado'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
