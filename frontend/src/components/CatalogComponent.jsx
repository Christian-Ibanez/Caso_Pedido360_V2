import Layout from './Layout';
import { useRoles } from '../hooks/useRoles';
import CustomerCatalog from './catalog/CustomerCatalog';
import AdminCatalog from './catalog/AdminCatalog';

export default function CatalogComponent() {
  const { isAdmin, resolved } = useRoles();
  return (
    <Layout title="Catálogo">
      {!resolved ? <div className="loading">Cargando…</div> : isAdmin ? <AdminCatalog /> : <CustomerCatalog />}
    </Layout>
  );
}
