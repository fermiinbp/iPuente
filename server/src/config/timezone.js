// Fija la zona horaria de la API en Europe/Madrid (Vercel corre en UTC). Se importa el primero, por su efecto lateral, para que local, Vercel y los tests calculen las fechas igual.
process.env.TZ = 'Europe/Madrid';

export const TIMEZONE = process.env.TZ;
