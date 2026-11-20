// Store de express-rate-limit sobre Firestore: contador compartido entre instancias (Netlify Functions). Solo para límites de poco volumen; el general sigue en memoria para no escribir en cada petición.
import { createHash } from 'node:crypto';

import * as rateLimitModel from '../models/rateLimitModel.js';
import { HttpError } from '../utils/httpError.js';

// failOpen: si Firestore falla, true deja pasar la petición (se registra el fallo) y false la
// corta con 503 (fallar cerrado: para lo que cuesta dinero).
export class FirestoreRateLimitStore {
  constructor({ prefix, failOpen }) {
    this.prefix = prefix;
    this.failOpen = failOpen;
    this.windowMs = 60_000;
  }

  // Id del documento: hash de prefijo y clave (las claves pueden llevar '/' o IPv6).
  docId(key) {
    return createHash('sha256').update(`${this.prefix}:${key}`).digest('hex');
  }

  // Recibe las opciones del limitador (la ventana).
  init(options) {
    this.windowMs = options.windowMs;
  }

  // Cuenta un hit y devuelve { totalHits, resetTime }; aplica la política de fallo del store.
  async increment(key) {
    try {
      return await rateLimitModel.hit(this.docId(key), this.windowMs);
    } catch (err) {
      console.error(`Rate limit ${this.prefix}: Firestore no disponible (${err.message})`);
      if (this.failOpen) return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
      throw new HttpError(
        503,
        'RATE_LIMIT_UNAVAILABLE',
        'Servicio no disponible. Inténtalo de nuevo en unos minutos.',
      );
    }
  }

  // Deshace un hit (express-rate-limit lo usa con skipFailedRequests, hoy desactivado).
  async decrement(key) {
    try {
      await rateLimitModel.release(this.docId(key));
    } catch {
      /* no crítico */
    }
  }

  // Borra el contador de una clave.
  async resetKey(key) {
    try {
      await rateLimitModel.remove(this.docId(key));
    } catch {
      /* no crítico */
    }
  }
}
