// Única función de Vercel: exporta la app de Express (server/src/app.js), que ya es un handler (req, res); vercel.json reescribe /api/* hacia aquí y Vercel conserva la URL original (/api/...).
import '../server/src/config/timezone.js';

import app from '../server/src/app.js';

export default app;
