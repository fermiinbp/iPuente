// Hace login con email y contraseña en Firebase Auth e imprime el ID token para probar la API (npm run get-token -w server -- correo contraseña).
// Uso (desde server/): node --env-file=.env scripts/getToken.js correo@ejemplo.com contraseña
const USAGE = 'Uso: npm run get-token -w server -- correo@ejemplo.com contraseña';

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error(USAGE);
    process.exit(1);
  }

  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) {
    console.error(
      'Falta FIREBASE_WEB_API_KEY en server/.env (es la clave web pública de Firebase).',
    );
    console.error(USAGE);
    process.exit(1);
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.idToken) {
    // EMAIL_NOT_FOUND, INVALID_PASSWORD, INVALID_LOGIN_CREDENTIALS… (nunca se imprime la contraseña).
    console.error(`No se pudo iniciar sesión: ${data.error?.message ?? `HTTP ${res.status}`}`);
    process.exit(1);
  }

  console.log(data.idToken);
  console.error('Pégalo en Authorize de /api/docs; caduca en 1 h.');
}

main().catch((err) => {
  console.error('Error al obtener el token:', err.message);
  process.exit(1);
});
