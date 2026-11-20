// Sesión y registro: única puerta de las pantallas para Firebase Auth y las rutas /auth de la API.
// EMP001 crea el archivo con registerCompany; CLI001 añade login, loginWithGoogle, register y logout.
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase.js';
import { post } from './apiClient.js';

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
