import Layout from './Layout';
import { useRoles } from '../hooks/useRoles';
import CustomerHome from './home/CustomerHome';
import AdminHome from './home/AdminHome';

export default function DashboardComponent() {
  const { isStaff, isAuditor, resolved } = useRoles();
  return (
    <Layout title="Inicio">
      {!resolved ? <div className="loading">Cargando…</div> : (isStaff || isAuditor) ? <AdminHome /> : <CustomerHome />}
    </Layout>
  );
}
