// Lectura de comprobación: llama a /api/health a través de apiClient.
import { get } from './apiClient.js';

export function getHealth(options) {
  return get('/health', options);
}
