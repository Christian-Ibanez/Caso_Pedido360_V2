import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import Layout from './Layout';
import { request } from '../api/http';
import OrderListComponent from './OrderListComponent';
import OrderDetailComponent from './OrderDetailComponent';

export default function OrdersComponent() {
  const { accounts } = useMsal();
  const account = accounts[0];
  const roles = account?.idTokenClaims?.roles || [];
  
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
      // The API endpoint should match the backend setup
      // In this case, we request the orders from the BFF
      const data = await request('/api/orders');
      if (Array.isArray(data)) {
        setOrders(data);
      } else {
        setOrders([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
  };

  const handleBackToList = () => {
    setSelectedOrder(null);
    fetchOrders(); // Refresh after returning from details/editing
  };

  return (
    <Layout title="Mis Pedidos">
      {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}
      
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
          orders={orders}
          loading={loading}
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
