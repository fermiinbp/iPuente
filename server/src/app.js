// Configura Express sin arrancarlo: CORS, límite de peticiones, webhook de Stripe (body sin parsear), JSON, /api/health, documentación Swagger en /api/docs, rutas y manejo de errores. Lo usan server.js, la función de Vercel (api/index.js) y los tests.
import './config/timezone.js';

import cors from 'cors';
import express from 'express';

import { config } from './config/config.js';
import { swaggerServe, swaggerSetup } from './config/swagger.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { generalLimiter } from './middlewares/rateLimit.js';
import routes from './index.js';
import webhookRoutes from './routes/webhook.routes.js';

const app = express();

// Detrás de Vercel llega un proxy: así req.ip es la IP real del cliente (para el rate limit).
app.set('trust proxy', 1);

// Origen permitido: sin Origin (curl, servidor a servidor, Swagger del mismo origen) se permite;
// con Origin solo APP_URL. Si no coincide, la respuesta sale sin cabeceras CORS y el navegador la bloquea.
export function corsOrigin(origin, callback) {
  const allowed = config.appUrl?.replace(/\/+$/, '');
  callback(null, !origin || origin === allowed);
}

// Orden: cors → webhook de Stripe (body sin parsear y fuera del límite general; lo protege la firma)
// → límite general → JSON → documentación → rutas.
app.use(cors({ origin: corsOrigin }));
app.use('/api/payments/webhook', webhookRoutes);
app.use('/api', generalLimiter);
app.use(express.json());

// Documentación de la API (Swagger UI); queda dentro del límite general.
app.use('/api/docs', swaggerServe, swaggerSetup);

app.use('/api', routes);

// Siempre al final: 404 y manejo de errores.
app.use(notFound);
app.use(errorHandler);

export default app;
