// Única función de Vercel: exporta la app de Express (server/src/app.js), que ya es un handler (req, res); vercel.json reescribe /api/* hacia aquí y Vercel conserva la URL original (/api/...).
// Antes de cargar la app se precarga jose (preloadJose.js): el cargador de Vercel no admite el
// require() de ESM que hace firebase-admin → jwks-rsa → jose. La app se importa después, de forma
// dinámica, para que firebase-admin no se cargue antes de la precarga.
import '../server/src/config/timezone.js';

await import('../server/src/config/preloadJose.js');
const { default: app } = await import('../server/src/app.js');

export default app;
