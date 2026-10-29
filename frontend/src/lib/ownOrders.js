// Pedidos que este cliente creo con un correo distinto al de su cuenta (por ejemplo, correos de prueba
// como cliente@fail.test). Como la lista "Mis pedidos" se filtra por correo, se recuerdan sus N° aqui para
// que sigan apareciendo. Se guarda en localStorage por cuenta; si el navegador lo bloquea, queda en memoria.
const KEY = 'p360.ownOrders';
let memory = null;

function read() {
  if (memory) return memory;
  try {
    memory = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    memory = {};
  }
  return memory;
}

export function ownOrderIds(account) {
  return read()[account] || [];
}

export function rememberOwnOrder(account, id) {
  if (!account || id == null) return;
  const all = read();
  const ids = all[account] || [];
  if (!ids.includes(id)) all[account] = [...ids, id];
  memory = all;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // sin almacenamiento disponible: queda en memoria
  }
}

/** Pedidos del cliente: los de su correo + los que creo con otro correo desde este navegador. */
export function isMine(order, email, id) {
  return (order.customerEmail || '').toLowerCase() === email || ownOrderIds(email).includes(id);
}
