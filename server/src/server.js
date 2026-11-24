// Arranca la API en local con app.listen. En producción no se usa: Vercel ejecuta app.js como función del servicio server (vercel.json).
import app from './app.js';

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.warn(`API de iPuente escuchando en http://localhost:${PORT}`);
});
