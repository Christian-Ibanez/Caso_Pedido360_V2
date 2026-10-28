// Categorías y fotos del catálogo.
// En la base las categorías se guardan sin tilde (Panaderia, Pasteleria, Cafeteria...).

export const CATEGORIES = ['Panaderia', 'Pasteleria', 'Cafeteria', 'Sandwiches', 'Bebidas'];

const LABELS = {
  panaderia: 'Panadería',
  pasteleria: 'Pastelería',
  cafeteria: 'Cafetería',
  sandwiches: 'Sandwiches',
  bebidas: 'Bebidas',
};

function norm(value) {
  return (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function categoryKey(category) {
  return norm(category);
}

export function categoryLabel(category) {
  return LABELS[norm(category)] || category || 'Sin categoría';
}

/** Color de fondo e ícono por categoría (se usa cuando el producto no tiene foto). */
export const CATEGORY_TINT = {
  panaderia: { bg: '#f6e7d7', fg: '#9a3412' },
  pasteleria: { bg: '#fbe4ee', fg: '#9d174d' },
  cafeteria: { bg: '#ede3d9', fg: '#6b4423' },
  sandwiches: { bg: '#e6efdc', fg: '#3f6212' },
  bebidas: { bg: '#dceef5', fg: '#0e7490' },
};

export function categoryTint(category) {
  return CATEGORY_TINT[norm(category)] || { bg: '#f5f5f4', fg: '#57534e' };
}

// Fotos incluidas en /public/products (nombre = SKU en minúsculas)
const PHOTOS = new Set([
  'pan-001', 'pan-002', 'pan-003', 'pan-004', 'pan-005', 'pan-006', 'pan-007', 'pan-008',
  'pas-001', 'pas-002', 'pas-003', 'pas-004', 'pas-005', 'pas-006', 'pas-007',
  'caf-001', 'caf-002', 'caf-003', 'caf-004', 'caf-005',
  'san-001', 'san-002', 'san-003', 'san-004',
  'beb-001', 'beb-002', 'beb-003', 'beb-004',
]);

export function productImage(product) {
  const sku = norm(product?.sku);
  return PHOTOS.has(sku) ? `/products/${sku}.jpg` : null;
}

export const LOW_STOCK = 10;

export function stockState(product) {
  const stock = Number(product?.stock) || 0;
  if (product?.active === false || stock <= 0) return 'out';
  if (stock <= LOW_STOCK) return 'low';
  return 'ok';
}

const CATEGORY_ORDER = ['panaderia', 'pasteleria', 'cafeteria', 'sandwiches', 'bebidas'];

/** Orden del catálogo: por categoría (panadería primero) y luego por SKU. */
export function compareProducts(a, b) {
  const ia = CATEGORY_ORDER.indexOf(norm(a.category));
  const ib = CATEGORY_ORDER.indexOf(norm(b.category));
  const ca = ia === -1 ? 99 : ia;
  const cb = ib === -1 ? 99 : ib;
  return ca - cb || (a.sku || '').localeCompare(b.sku || '');
}

export function isAvailable(product) {
  return stockState(product) !== 'out';
}
