// Configuración del backend y conexión a la base de datos: lee y valida las variables de entorno y conecta con Firebase (Firestore y Auth) mediante firebase-admin.
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const REQUIRED_VARS = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'APP_URL',
];

// ¿Es producción? NODE_ENV=production o cualquier entorno de Vercel (VERCEL_ENV: production,
// preview o development): así un NODE_ENV mal puesto en Vercel no deja abierta la configuración.
export function isProductionEnv(env = process.env) {
  return env.NODE_ENV === 'production' || Boolean(env.VERCEL_ENV);
}

export const isProduction = isProductionEnv();

const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.warn(`Faltan variables de entorno: ${missing.join(', ')}. Revisa server/.env.`);
}

// En producción no arrancamos sin credenciales de Firebase: mejor fallar al desplegar que en la primera petición.
const missingFirebase = missing.filter((name) => name.startsWith('FIREBASE_'));
if (isProduction && missingFirebase.length > 0) {
  throw new Error(`Faltan variables de Firebase en producción: ${missingFirebase.join(', ')}.`);
}
// APP_URL es el único origen que permite CORS: en producción tampoco hay valor por defecto.
if (isProduction && missing.includes('APP_URL')) {
  throw new Error('Falta APP_URL en producción: es el único origen que permite CORS.');
}

// Vercel (y muchos .env) guardan la clave con "\n" literales: los convertimos en saltos reales.
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

export const config = {
  port: Number(process.env.PORT) || 3000,
  // En producción no hay valor por defecto: así localhost nunca acaba en el CORS desplegado.
  appUrl: process.env.APP_URL || (isProduction ? undefined : 'http://localhost:5173'),
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey,
  },
  // Bucket de Firebase Storage (mismo valor que VITE_FIREBASE_STORAGE_BUCKET del front). Opcional:
  // si falta, el validator de URLs de imágenes rechaza cualquier URL.
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET?.trim() || undefined,
};

// Fija el bucket de Storage en los tests (undefined simula que no está configurado).
export function setStorageBucketForTests(bucket) {
  config.storageBucket = bucket;
}

// Inicializa firebase-admin una sola vez (Vercel reutiliza el proceso entre peticiones).
function getFirebaseApp() {
  if (getApps().length > 0) return getApps()[0];

  const { projectId, clientEmail, privateKey: key } = config.firebase;
  if (!projectId || !clientEmail || !key) {
    throw new Error(
      'No se puede conectar con Firebase: faltan FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY.',
    );
  }

  // Si la clave está mal pegada, el error del SDK podría incluir trozos de ella: lo sustituimos por uno genérico.
  let credential;
  try {
    credential = cert({ projectId, clientEmail, privateKey: key });
  } catch {
    throw new Error(
      'FIREBASE_PRIVATE_KEY no es válida: cópiala entera del JSON de la cuenta de servicio, entre comillas dobles.',
    );
  }

  return initializeApp({ credential });
}

// Doble de Firestore para los tests unitarios de los models (nunca se usa en la app).
let testDb = null;

// Sustituye Firestore por un doble en memoria. Pasa null para volver al Firestore real.
export function setDbForTests(fakeDb) {
  testDb = fakeDb;
}

// Firestore. Única puerta de acceso a la base de datos para los models.
export function db() {
  if (testDb) return testDb;
  return getFirestore(getFirebaseApp());
}

// Firebase Auth: verificar tokens y gestionar custom claims.
export function adminAuth() {
  return getAuth(getFirebaseApp());
}
