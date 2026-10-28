import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/http';
import { getCatalogProducts } from '../api/catalog';
import { NEW_NOTIFICATIONS_EVENT } from '../lib/notifications';
import { publishPendingCount } from '../components/Layout';

/** Catálogo completo (se filtra en el navegador) y un mapa por id. */
export function useCatalog() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCatalogProducts();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const byId = useMemo(() => {
    const map = {};
    products.forEach((p) => { map[p.id] = p; });
    return map;
  }, [products]);

  return { products, setProducts, byId, loading, error, reload };
}

/** Pedidos desde ms-orders (vía BFF). */
export function useOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await api.get('/api/orders');
      setOrders(Array.isArray(data) ? data : []);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Cuando la campana trae un aviso nuevo (pedido creado o confirmado vía RabbitMQ), refresca la lista
  useEffect(() => {
    const onNew = () => {
      reload({ silent: true }).then((data) => { if (data) publishPendingCount(data); });
    };
    window.addEventListener(NEW_NOTIFICATIONS_EVENT, onNew);
    return () => window.removeEventListener(NEW_NOTIFICATIONS_EVENT, onNew);
  }, [reload]);

  return { orders, setOrders, loading, error, reload };
}

export function changeOrderStatus(id, status) {
  return api.put(`/api/orders/${id}/status`, { status });
}
