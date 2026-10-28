export const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

// Si el BFF o un microservicio no contesta en este tiempo, la vista muestra "no disponible"
const DEFAULT_TIMEOUT_MS = 12000;

// MSAL registra aqui una funcion que entrega el access token vigente
let tokenProvider = async () => null;

export function setTokenProvider(provider) {
  tokenProvider = provider;
}

const STATUS_MESSAGES = {
  401: 'Tu sesión no es válida o expiró. Cierra sesión y vuelve a entrar.',
  403: 'No tienes permisos para realizar esta acción.',
  404: 'No se encontró el recurso solicitado.',
  409: 'La operación no se pudo completar por el estado actual (por ejemplo, falta stock).',
  500: 'Ocurrió un error en el servidor. Intenta de nuevo más tarde.',
  502: 'El servicio no está disponible en este momento.',
  503: 'El servicio no está disponible en este momento.',
  504: 'El servicio tardó demasiado en responder.',
};

/** Error de API con el código HTTP y si el servicio está caído o no responde. */
export class ApiError extends Error {
  constructor(message, { status = 0, unavailable = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.unavailable = unavailable;
  }
}

export async function request(path, { method = 'GET', body, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = await tokenProvider();
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = err?.name === 'AbortError';
    throw new ApiError(
      timedOut
        ? 'El servicio tardó demasiado en responder.'
        : `No se pudo conectar con el backend (${API_URL}). ¿Está levantado?`,
      { unavailable: true },
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const defaultMsg = STATUS_MESSAGES[res.status] || `Error ${res.status} llamando a ${path}`;
    throw new ApiError(data?.detail || data?.message || defaultMsg, {
      status: res.status,
      unavailable: [502, 503, 504].includes(res.status),
    });
  }

  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
};
