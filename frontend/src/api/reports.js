import { api } from './http';

export async function getKpis(range = 'last24h') {
  return await api.get(`/api/report/kpis?range=${encodeURIComponent(range)}`);
}

export async function getTopProducts(range = 'last7d', limit = 5) {
  return await api.get(`/api/report/top-products?range=${encodeURIComponent(range)}&limit=${limit}`);
}

export async function getSalesByHour(range = 'last24h') {
  return await api.get(`/api/report/sales-by-hour?range=${encodeURIComponent(range)}`);
}

export async function getLeadTime(range = 'last24h') {
  return await api.get(`/api/report/lead-time?range=${encodeURIComponent(range)}`);
}
