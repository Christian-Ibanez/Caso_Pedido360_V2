export const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8085').replace(/\/$/, '');

// MSAL registra aqui una funcion que entrega el access token vigente
let tokenProvider = async () => null;

export function setTokenProvider(provider) {
  tokenProvider = provider;
}

const STATUS_MESSAGES = {
  401: 'Tu sesión no es válida o expiró. Cierra sesión y vuelve a entrar.',
  403: 'No tienes permisos para realizar esta acción.',
  500: 'Ocurrió un error en el servidor. Intenta de nuevo más tarde.'
};

export async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = await tokenProvider();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`No se pudo conectar con el backend (${API_URL}). ¿Está levantado?`);
  }

  if (res.status === 204) return null;
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok) {
    const defaultMsg = STATUS_MESSAGES[res.status] || `Error ${res.status} llamando a ${path}`;
    throw new Error(data?.detail || data?.message || defaultMsg);
  }
  
  return data;
}

export const api = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path) => request(path, { method: 'DELETE' })
};
