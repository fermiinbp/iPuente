// Única Netlify Function: envuelve la app de Express (server/src/app.js) con serverless-http para que la API funcione en Netlify sin servidor propio.
import '../../server/src/config/timezone.js';

import serverless from 'serverless-http';

import app from '../../server/src/app.js';

const FUNCTION_PREFIX = '/.netlify/functions/api';
const expressHandler = serverless(app);

// Express espera rutas /api/...: con el redirect 200 de netlify.toml la ruta original se conserva,
// pero si llegara con el prefijo de la función se lo quitamos para no dar 404.
export async function handler(event, context) {
  const path = event.path?.startsWith(FUNCTION_PREFIX)
    ? `/api${event.path.slice(FUNCTION_PREFIX.length)}`
    : event.path;
  return expressHandler({ ...event, path }, context);
}
