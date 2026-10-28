import Layout from './Layout';
import { useRoles } from '../hooks/useRoles';
import CustomerOrders from './orders/CustomerOrders';
import AdminOrders from './orders/AdminOrders';

export default function OrdersComponent() {
  const { isStaff, resolved } = useRoles();
  return (
    <Layout title={isStaff ? 'Gestión de pedidos' : 'Mis pedidos'}>
      {!resolved ? <div className="loading">Cargando…</div> : isStaff ? <AdminOrders /> : <CustomerOrders />}
    </Layout>
  );
}
