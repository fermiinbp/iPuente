// Se carga antes de los tests (node --import): fija NODE_ENV=test en cualquier plataforma (con NODE_ENV=test los límites de peticiones se saltan salvo que un test los active) y la zona horaria Europe/Madrid, igual que la API.
import '../src/config/timezone.js';

process.env.NODE_ENV ||= 'test';
