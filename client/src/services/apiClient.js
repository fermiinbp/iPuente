// Cliente HTTP único: añade el token de Firebase a cada petición y convierte los errores de la API ({ error: { code, message } }) en excepciones.
import { auth } from '../config/firebase.js';
import { API_URL } from '../config/constants.js';

export class ApiError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiClient(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const finalHeaders = { Accept: 'application/json', ...headers };

  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  const options = { method, headers: finalHeaders, signal };
  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, options);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'No se pudo conectar con el servidor. Inténtalo de nuevo.',
    );
  }

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const apiError = data?.error;
    // Un error sin { error: { message } } no lo ha dado nuestra API: otra aplicación en el puerto, la API caída o un
    // fallo de la plataforma. En desarrollo se avisa en la consola para saber dónde mirar.
    if (!apiError && import.meta.env.DEV) {
      console.warn(
        `[api] ${options.method} ${API_URL}${path} → HTTP ${response.status} sin JSON de error. ¿Está arrancada la API? ` +
          'En local /api/health debe responder {"ok":true} en el destino del proxy (client/vite.config.js).',
      );
    }
    const unavailable = response.status === 404 || response.status >= 500;
    throw new ApiError(
      response.status,
      apiError?.code ?? 'UNKNOWN_ERROR',
      apiError?.message ??
        (unavailable
          ? 'No se ha podido contactar con el servidor. Inténtalo de nuevo en unos minutos.'
          : 'Ha ocurrido un error inesperado. Inténtalo de nuevo.'),
      apiError?.details ?? null,
    );
  }

  return data;
}

export const get = (path, options) => apiClient(path, { ...options, method: 'GET' });
export const post = (path, body, options) => apiClient(path, { ...options, method: 'POST', body });
export const patch = (path, body, options) =>
  apiClient(path, { ...options, method: 'PATCH', body });
export const del = (path, options) => apiClient(path, { ...options, method: 'DELETE' });
