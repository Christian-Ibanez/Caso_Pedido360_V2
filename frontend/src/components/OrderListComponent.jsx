import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import OrderStatusBadgeComponent from './OrderStatusBadgeComponent';
import { api } from '../api/http';
import { REGIONES_CHILE } from '../data/chile';

const BAKERY_PRODUCTS = [
  { id: 1, name: 'Croissant', price: 2.50 },
  { id: 2, name: 'Pan de Bono', price: 1.00 },
  { id: 3, name: 'Café Americano', price: 1.50 },
  { id: 4, name: 'Capuchino', price: 2.00 },
  { id: 5, name: 'Torta de Chocolate', price: 3.50 }
];

export default function OrderListComponent({ orders, loading, onSelectOrder, onRefresh, isAdmin, isOperator, isCustomer }) {
  const { accounts } = useMsal();
  const userEmail = accounts[0]?.username || accounts[0]?.idTokenClaims?.preferred_username || '';

  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [selectedRows, setSelectedRows] = useState([]);
  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState('');
  
  // New order state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState(userEmail);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedComuna, setSelectedComuna] = useState('');
  const [calle, setCalle] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState([]); // { product, quantity }

  const comunasDisponibles = REGIONES_CHILE.find(r => r.region === selectedRegion)?.comunas || [];

  const filteredOrders = orders.filter(order => {
    const textMatch = (order.id || order.orderId || '').toString().includes(filter) ||
                      (order.customerName || order.description || '').toLowerCase().includes(filter.toLowerCase());
    
    let statusMatch = true;
    if (statusFilter === 'CREADOS') {
      statusMatch = order.status === 'CREADO';
    } else if (statusFilter === 'EN_PROCESO') {
      statusMatch = ['ACEPTADO', 'EN_PREPARACION', 'DESPACHADO'].includes(order.status);
    } else if (statusFilter === 'COMPLETADOS') {
      statusMatch = order.status === 'ENTREGADO';
    } else if (statusFilter === 'CANCELADOS') {
      statusMatch = order.status === 'CANCELADO';
    }
    
    return textMatch && statusMatch;
  });

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
        deliveryAddress: `${calle}, ${selectedComuna}, ${selectedRegion}`,
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
      setCustomerEmail(userEmail);
      setSelectedRegion('');
      setSelectedComuna('');
      setCalle('');
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

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRows(filteredOrders.map(o => o.id || o.orderId));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedRows(prev => prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]);
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Fecha', 'Cliente', 'Email', 'Estado', 'Total'];
    const rows = filteredOrders.map(o => [
      o.id || o.orderId,
      o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '',
      `"${o.customerName || ''}"`,
      o.customerEmail || '',
      o.status || '',
      o.total || 0
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `pedidos_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleQuickStatusChange = async (orderId, newStatus) => {
    try {
      await api.put(`/api/orders/${orderId}/status`, { status: newStatus });
      onRefresh();
    } catch (err) {
      alert("Error al cambiar estado: " + err.message);
    }
  };

  const handleBatchStatusChange = async (newStatus) => {
    if (!newStatus || selectedRows.length === 0) return;
    try {
      await Promise.all(selectedRows.map(id => api.put(`/api/orders/${id}/status`, { status: newStatus })));
      setSelectedRows([]);
      onRefresh();
    } catch (err) {
      alert("Error en actualización masiva: " + err.message);
    }
  };

  const canCreate = isCustomer || isOperator;

  return (
    <div>
      {/* Barra de Herramientas Unificada (Toolbar) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem', backgroundColor: '#fff', padding: '1rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        
        {/* Tabs de Filtro por Estado */}
        <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#f3f4f6', padding: '0.25rem', borderRadius: '8px', width: '100%', overflowX: 'auto' }}>
          {[
            { id: 'TODOS', label: `Todos (${orders.length})` },
            { id: 'CREADOS', label: `Nuevos (${orders.filter(o=>o.status==='CREADO').length})` },
            { id: 'EN_PROCESO', label: `En Proceso (${orders.filter(o=>['ACEPTADO','EN_PREPARACION','DESPACHADO'].includes(o.status)).length})` },
            { id: 'COMPLETADOS', label: `Completados (${orders.filter(o=>o.status==='ENTREGADO').length})` },
            { id: 'CANCELADOS', label: `Cancelados (${orders.filter(o=>o.status==='CANCELADO').length})` }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => { setStatusFilter(tab.id); setSelectedRows([]); }}
              style={{
                padding: '0.5rem 1rem', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: 'pointer', 
                fontWeight: '500', 
                fontSize: '0.875rem',
                backgroundColor: statusFilter === tab.id ? '#fff' : 'transparent',
                color: statusFilter === tab.id ? '#111827' : '#6b7280',
                boxShadow: statusFilter === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1, flexWrap: 'wrap', marginTop: '0.5rem' }}>
          <div style={{ position: 'relative', minWidth: '250px' }}>
            <input 
              type="text" 
              placeholder="Buscar por ID, cliente..." 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ padding: '0.5rem 0.5rem 0.5rem 2rem', width: '100%', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none' }}
            />
            <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>🔍</span>
          </div>
          
          <button onClick={onRefresh} disabled={loading} style={{ padding: '0.5rem', backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Actualizar">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          </button>
          
          {(isAdmin || isOperator) && (
            <button onClick={exportToCSV} style={{ padding: '0.5rem 1rem', backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#4b5563', fontWeight: '500' }} title="Exportar a CSV">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              Exportar
            </button>
          )}
        </div>

        {canCreate && !isFormOpen && (
          <button className="btn primary" onClick={() => setIsFormOpen(true)} style={{ whiteSpace: 'nowrap', marginTop: '0.5rem' }}>
            + Nuevo Pedido
          </button>
        )}
      </div>

      {/* Batch Actions Bar */}
      {selectedRows.length > 0 && (isAdmin || isOperator) && (
        <div style={{ padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #bfdbfe' }}>
          <span style={{ color: '#1e40af', fontWeight: '600' }}>{selectedRows.length} pedidos seleccionados</span>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ color: '#1e3a8a', fontSize: '0.875rem', fontWeight: '500' }}>Cambiar estado a:</span>
            <select onChange={(e) => handleBatchStatusChange(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #93c5fd', outline: 'none', cursor: 'pointer', fontWeight: '500' }}>
              <option value="">-- Seleccionar --</option>
              <option value="CREADO">CREADO</option>
              <option value="ACEPTADO">ACEPTADO</option>
              <option value="EN_PREPARACION">EN PREPARACIÓN</option>
              <option value="DESPACHADO">DESPACHADO</option>
              <option value="ENTREGADO">ENTREGADO</option>
              <option value="CANCELADO">CANCELADO</option>
            </select>
          </div>
        </div>
      )}

      {canCreate && isFormOpen && (
        <form onSubmit={handleCreateOrder} style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#111827' }}>Crear Nuevo Pedido (Panadería y Cafés)</h3>
          
          {creationError && (
            <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #f87171' }}>
              {creationError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>Nombre del Cliente</label>
              <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>Email del Cliente</label>
              <input 
                type="email" 
                value={customerEmail} 
                onChange={e => setCustomerEmail(e.target.value)} 
                required 
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: (isCustomer && !isAdmin && !isOperator) ? '#f3f4f6' : '#fff' }} 
                readOnly={isCustomer && !isAdmin && !isOperator}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>Región</label>
              <select 
                value={selectedRegion} 
                onChange={e => { setSelectedRegion(e.target.value); setSelectedComuna(''); }} 
                required 
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
              >
                <option value="">-- Selecciona Región --</option>
                {REGIONES_CHILE.map(r => (
                  <option key={r.region} value={r.region}>{r.region}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>Comuna</label>
              <select 
                value={selectedComuna} 
                onChange={e => setSelectedComuna(e.target.value)} 
                required 
                disabled={!selectedRegion}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: !selectedRegion ? '#f3f4f6' : '#fff' }}
              >
                <option value="">-- Selecciona Comuna --</option>
                {comunasDisponibles.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>Calle y Número</label>
              <input type="text" value={calle} onChange={e => setCalle(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>Notas adicionales</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
            <h4 style={{ marginTop: 0 }}>Productos</h4>
            <select onChange={(e) => { handleAddItem(e.target.value); e.target.value = ''; }} style={{ padding: '0.5rem', marginBottom: '1rem', width: '100%', border: '1px solid #d1d5db', borderRadius: '4px' }}>
              <option value="">-- Seleccionar producto para agregar --</option>
              {BAKERY_PRODUCTS.map(p => (
                <option key={p.id} value={p.id}>{p.name} - ${p.price.toFixed(2)}</option>
              ))}
            </select>

            {selectedItems.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {selectedItems.map(item => (
                  <li key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: '#fff', border: '1px solid #e5e7eb', marginBottom: '0.5rem', borderRadius: '4px' }}>
                    <span><span style={{ fontWeight: 'bold', color: '#374151', marginRight: '0.5rem' }}>{item.quantity}x</span> {item.product.name}</span>
                    <span>
                      ${(item.quantity * item.product.price).toFixed(2)}
                      <button type="button" onClick={() => handleRemoveItem(item.product.id)} style={{ marginLeft: '1rem', color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                    </span>
                  </li>
                ))}
                <li style={{ textAlign: 'right', fontWeight: 'bold', padding: '1rem 0.5rem 0', fontSize: '1.1rem', color: '#111827' }}>
                  Total: ${selectedItems.reduce((acc, item) => acc + (item.quantity * item.product.price), 0).toFixed(2)}
                </li>
              </ul>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setIsFormOpen(false)} style={{ backgroundColor: '#fff', border: '1px solid #d1d5db', color: '#374151' }}>
              Cancelar
            </button>
            <button type="submit" className="btn primary" disabled={creating}>
              {creating ? 'Procesando...' : 'Crear Pedido'}
            </button>
          </div>
        </form>
      )}

      {loading && orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Cargando pedidos...</div>
      ) : filteredOrders.length > 0 ? (
        <div style={{ overflowX: 'auto', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb', textAlign: 'left', color: '#4b5563', fontSize: '0.875rem' }}>
                {(isAdmin || isOperator) && (
                  <th style={{ padding: '1rem', width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      onChange={handleSelectAll} 
                      checked={selectedRows.length > 0 && selectedRows.length === filteredOrders.length} 
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                )}
                <th style={{ padding: '1rem' }}>ID</th>
                <th style={{ padding: '1rem' }}>Fecha</th>
                <th style={{ padding: '1rem' }}>Cliente / Info</th>
                <th style={{ padding: '1rem' }}>Total</th>
                <th style={{ padding: '1rem' }}>Estado</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.sort((a,b) => b.id - a.id).map(order => (
                <tr key={order.id || order.orderId} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background-color 0.15s', backgroundColor: selectedRows.includes(order.id || order.orderId) ? '#f0fdf4' : '#fff' }}>
                  {(isAdmin || isOperator) && (
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedRows.includes(order.id || order.orderId)}
                        onChange={() => handleSelectRow(order.id || order.orderId)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                  )}
                  <td style={{ padding: '1rem', fontWeight: '500', color: '#111827' }}>#{order.id || order.orderId}</td>
                  <td style={{ padding: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: '500', color: '#111827' }}>{order.customerName || order.description || 'Sin descripción'}</div>
                    {order.customerEmail && <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{order.customerEmail}</div>}
                  </td>
                  <td style={{ padding: '1rem', fontWeight: '600', color: '#111827' }}>
                    ${(order.total || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {(isAdmin || isOperator) ? (
                      <select 
                        value={order.status || 'CREADO'} 
                        onChange={(e) => handleQuickStatusChange(order.id || order.orderId, e.target.value)}
                        style={{ 
                          padding: '0.4rem', 
                          borderRadius: '6px', 
                          border: '1px solid #d1d5db', 
                          fontSize: '0.85rem', 
                          fontWeight: '600',
                          backgroundColor: '#f9fafb',
                          color: '#374151',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        <option value="CREADO">CREADO</option>
                        <option value="ACEPTADO">ACEPTADO</option>
                        <option value="EN_PREPARACION">EN PREPARACIÓN</option>
                        <option value="DESPACHADO">DESPACHADO</option>
                        <option value="ENTREGADO">ENTREGADO</option>
                        <option value="CANCELADO">CANCELADO</option>
                      </select>
                    ) : (
                      <OrderStatusBadgeComponent status={order.status || 'CREADO'} />
                    )}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <button 
                      onClick={() => onSelectOrder(order)}
                      style={{ background: 'transparent', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.4rem 0.6rem', cursor: 'pointer', color: '#4b5563', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Ver Detalle"
                      onMouseOver={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                      onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', color: '#6b7280' }}>
          No se encontraron pedidos.
        </div>
      )}
    </div>
  );
}
