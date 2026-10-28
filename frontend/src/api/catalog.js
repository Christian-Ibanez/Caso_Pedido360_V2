import { api } from './http';

export async function getCatalogProducts({ q, category, onlyActive } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  if (onlyActive !== undefined) params.set('onlyActive', onlyActive);

  const qs = params.toString();
  const path = `/api/catalog/products${qs ? `?${qs}` : ''}`;
  return await api.get(path);
}

export async function getCatalogProduct(id) {
  return await api.get(`/api/catalog/products/${id}`);
}

export async function createCatalogProduct(productData) {
  return await api.post('/api/catalog/products', productData);
}

export async function updateCatalogProduct(id, productData) {
  return await api.put(`/api/catalog/products/${id}`, productData);
}

export async function deleteCatalogProduct(id) {
  return await api.delete(`/api/catalog/products/${id}`);
}
