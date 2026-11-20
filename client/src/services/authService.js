// Sesión del usuario con Firebase Auth: entrar, registrarse, Google, salir y recuperar la contraseña,
// y el alta de empresa (registerCompany, de EMP001, que usa las rutas /auth de la API).
// Los componentes no llaman a Firebase: pasan por aquí. Los errores salen ya en español.
import {
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { auth } from '../config/firebase.js';
import { post } from './apiClient.js';

const MESSAGES = {
  'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
  'auth/invalid-login-credentials': 'El correo o la contraseña no son correctos.',
  'auth/user-not-found': 'El correo o la contraseña no son correctos.',
  'auth/wrong-password': 'El correo o la contraseña no son correctos.',
  'auth/invalid-email': 'Escribe un correo válido.',
  'auth/email-already-in-use': 'Ya existe una cuenta con este correo. Inicia sesión.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  'auth/network-request-failed': 'No hay conexión. Revisa tu red e inténtalo de nuevo.',
  'auth/user-disabled': 'Esta cuenta está desactivada.',
  'auth/expired-action-code': 'El enlace ha caducado. Pide uno nuevo.',
  'auth/invalid-action-code': 'El enlace no es válido o ya se ha usado. Pide uno nuevo.',
  'auth/requires-recent-login': 'Por seguridad, vuelve a iniciar sesión e inténtalo de nuevo.',
  'auth/operation-not-allowed': 'El acceso con Google no está activado en Firebase.',
  'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase Authentication.',
  'auth/popup-blocked':
    'El navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes.',
  'auth/account-exists-with-different-credential':
    'Ya existe una cuenta con este correo. Entra con tu contraseña.',
};

// Convierte un error de Firebase en un mensaje para la persona. Cerrar la ventana de Google no es un error.
export function authErrorMessage(error) {
  if (
    error?.code === 'auth/popup-closed-by-user' ||
    error?.code === 'auth/cancelled-popup-request'
  ) {
    return '';
  }
  if (import.meta.env.DEV) console.error('[auth]', error?.code, error?.message);
  return MESSAGES[error?.code] ?? 'No se ha podido completar la operación. Inténtalo de nuevo.';
}

export async function signInWithEmail(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return user;
}

export async function registerWithEmail({ name, email, password }) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(user, { displayName: name });
  return user;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const { user } = await signInWithPopup(auth, provider);
  return user;
}

export function signOutUser() {
  return signOut(auth);
}

export function sendResetEmail(email) {
  return sendPasswordResetEmail(auth, email);
}

// ¿La cuenta entra con correo y contraseña? (las de Google no tienen contraseña propia.)
export function hasPasswordLogin(user) {
  return Boolean(user?.providerData?.some((provider) => provider.providerId === 'password'));
}

// Cambia el nombre que se enseña en la cuenta.
export async function updateDisplayName(name) {
  if (!auth.currentUser) throw new Error('No hay sesión iniciada.');
  await updateProfile(auth.currentUser, { displayName: name });
  await auth.currentUser.reload();
  // Renovar el token hace que onIdTokenChanged avise a la app y la cabecera enseñe el nombre nuevo.
  await auth.currentUser.getIdToken(true);
}

// Cambia la contraseña. Firebase pide confirmar antes la actual (reautenticar).
export async function changePassword(current, next) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('No hay sesión iniciada.');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
  await updatePassword(user, next);
}

// Rol de la sesión actual (custom claim `role`); sin claim, es cliente.
export async function getCurrentRole() {
  const result = await auth.currentUser?.getIdTokenResult();
  return result?.claims?.role ?? 'CLIENT';
}

// Comprueba el código del enlace de recuperación y devuelve el correo de la cuenta. Lanza si caducó o no vale.
export function checkResetCode(code) {
  return verifyPasswordResetCode(auth, code);
}

// Fija la contraseña nueva con el código del enlace.
export function confirmReset(code, newPassword) {
  return confirmPasswordReset(auth, code, newPassword);
}

// Alta de empresa (queda pendiente de aprobación) y, a continuación, inicio de sesión con la cuenta nueva.
// `datos`: { email, password, personaContacto, nombreEmpresa, cif, telefono, emailContacto, ciudad }.
// Errores de la API (ApiError): EMAIL_EXISTS, EMAIL_IS_CLIENT, COMPANY_EXISTS y VALIDATION_ERROR (con `details`).
// Devuelve { uid, companyId, estado }.
export async function registerCompany(datos) {
  const { email, password, personaContacto, nombreEmpresa, cif, telefono } = datos;
  // TODO(DAT030): enviar también emailContacto, ciudad y la aceptación de las condiciones cuando la API los acepte.
  // La API pide `nombre` (titular de la cuenta) y `contacto` (persona de contacto): los dos son la misma persona.
  const result = await post('/auth/register/company', {
    email,
    password,
    nombre: personaContacto,
    contacto: personaContacto,
    nombreEmpresa,
    cif,
    telefono,
  });
  // El servidor ya ha puesto el rol COMPANY en la cuenta: el token de este inicio de sesión lo trae.
  await signInWithEmailAndPassword(auth, email, password);
  return result;
}
