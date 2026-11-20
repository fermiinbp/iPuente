// Fija la zona horaria de la API en Europe/Madrid (Netlify corre en UTC). Se importa el primero, por su efecto lateral, para que local, Netlify y los tests calculen las fechas igual.
process.env.TZ = 'Europe/Madrid';

export const TIMEZONE = process.env.TZ;
