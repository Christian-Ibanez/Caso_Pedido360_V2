import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import Layout from './Layout';
import { api } from '../api/http';
import OrderListComponent from './OrderListComponent';
import OrderDetailComponent from './OrderDetailComponent';
import { getAccessToken, decodeClaims } from '../auth/token';

export default function OrdersComponent() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  
  // Leemos inicialmente del ID Token, pero luego validaremos el Access Token
  const [roles, setRoles] = useState(account?.idTokenClaims?.roles || []);
  const [authResolved, setAuthResolved] = useState(false);
  
  const isAdmin = roles.includes('Admin');
  const isOperator = roles.includes('Operator');
  const isCustomer = roles.includes('Customer') || (!isAdmin && !isOperator);
  
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/api/orders');
      if (Array.isArray(data)) {
        setOrders(data);
      } else {
        setOrders([]);
      }
    } catch (err) {
      setError(err.message);
      // Fallback a array vacío si falla la carga inicial
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtrado dinámico en tiempo de render
  const visibleOrders = (isCustomer && !isAdmin && !isOperator)
    ? orders.filter(o => o.customerEmail?.toLowerCase() === (account?.username || account?.idTokenClaims?.preferred_username)?.toLowerCase())
    : orders;

  useEffect(() => {
    const fetchRolesFromAccessToken = async () => {
      if (!account) return;
      try {
        const token = await getAccessToken(instance, account);
        if (token) {
          const claims = decodeClaims(token);
          if (claims.roles) {
            setRoles(claims.roles);
          }
        }
      } catch (err) {
        console.error('Error al decodificar token de acceso:', err);
      } finally {
        setAuthResolved(true);
      }
    };
    fetchRolesFromAccessToken();
    fetchOrders();
  }, [instance, account]);

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
  };

  const handleBackToList = () => {
    setSelectedOrder(null);
    fetchOrders(); // Refresh after returning from details/editing
  };

  return (
    <Layout title={(isAdmin || isOperator) ? 'Gestión de Pedidos' : 'Mis Pedidos'}>
      {error && (
        <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {selectedOrder ? (
        <OrderDetailComponent 
          orderId={selectedOrder.id || selectedOrder.orderId}
          isAdmin={isAdmin}
          isOperator={isOperator}
          isCustomer={isCustomer}
          onBack={handleBackToList}
        />
      ) : (
        <OrderListComponent 
          orders={visibleOrders}
          loading={loading || !authResolved}
          onSelectOrder={handleSelectOrder}
          onRefresh={fetchOrders}
          isAdmin={isAdmin}
          isOperator={isOperator}
          isCustomer={isCustomer}
        />
      )}
    </Layout>
  );
}
