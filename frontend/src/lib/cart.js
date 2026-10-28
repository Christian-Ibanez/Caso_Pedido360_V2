// Carrito del catálogo: { [productId]: cantidad }.
// Vive en memoria y se respalda en sessionStorage para sobrevivir a un refresco;
// si el navegador bloquea el almacenamiento, sigue funcionando solo en memoria.
const KEY = 'p360.cart';
let memory = null;

function read() {
  if (memory) return memory;
  try {
    memory = JSON.parse(sessionStorage.getItem(KEY) || '{}') || {};
  } catch {
    memory = {};
  }
  return memory;
}

function write(cart) {
  memory = cart;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(cart));
  } catch {
    // sin almacenamiento disponible: queda en memoria
  }
}

export function getCart() {
  return { ...read() };
}

export function setCart(cart) {
  const clean = {};
  Object.entries(cart).forEach(([id, qty]) => {
    if (qty > 0) clean[id] = qty;
  });
  write(clean);
  return clean;
}

export function clearCart() {
  write({});
}
