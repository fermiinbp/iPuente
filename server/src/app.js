// Configura Express sin arrancarlo: CORS, límite de peticiones, webhook de Stripe (body sin parsear), JSON, /api/health, documentación Swagger en /api/docs, rutas y manejo de errores. Lo usan server.js, la Netlify Function y los tests.
import cors from 'cors';
import express from 'express';

import { errorHandler, notFound } from './middlewares/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Siempre al final: 404 y manejo de errores.
app.use(notFound);
app.use(errorHandler);

export default app;
