// Datos del formulario de alta de empresa (EMP001): valores iniciales, validación en el front, traducción de los
// errores de la API a cada campo y conversión entre la respuesta de GET /companies/me y el formulario.
import { isValidCif, normalizeCif } from './cif.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mismo criterio que la API: 9 dígitos que empiezan por 6, 7, 8 o 9.
const PHONE = /^[6-9]\d{8}$/;
const MAX_TEXT = 100;

// Pasos del alta (Stepper de CompanyRegister y CompanyRequestStatus).
export const COMPANY_STEPS = [
  'Tu cuenta y empresa',
  'Revisión por iPuente',
  'Conecta tus cobros',
  'Publica tus espacios',
];

export const EMPTY_ACCOUNT = { email: '', password: '', password2: '', condiciones: false };

export const EMPTY_COMPANY = {
  nombreEmpresa: '',
  cif: '',
  telefono: '',
  personaContacto: '',
  emailContacto: '',
  ciudad: '',
};

// Mensaje de cada campo cuando la API lo rechaza (VALIDATION_ERROR): los suyos llevan el nombre técnico del campo.
const FIELD_MESSAGES = {
  email: 'Revisa el email de acceso.',
  password: 'La contraseña debe tener entre 8 y 128 caracteres.',
  personaContacto: 'Escribe el nombre de la persona de contacto.',
  nombreEmpresa: 'Escribe el nombre de la empresa.',
  cif: 'El CIF no es válido.',
  telefono: 'El teléfono debe tener 9 dígitos y empezar por 6, 7, 8 o 9.',
  emailContacto: 'Escribe un email de contacto válido.',
  ciudad: 'Escribe la ciudad.',
};

// Errores de la API con un código propio que se pintan en el campo CIF (PATCH /companies/me).
// FIELD_NOT_EDITABLE (empresa aprobada entre medias) no es de un campo: se muestra el mensaje de la API.
const CODE_FIELD_ERRORS = {
  COMPANY_EXISTS: 'Ya hay una empresa registrada con este CIF.',
};

// { cif: mensaje } si el código de error de la API es uno de CODE_FIELD_ERRORS; si no, null.
export function codeErrorToFields(code) {
  return CODE_FIELD_ERRORS[code] ? { cif: CODE_FIELD_ERRORS[code] } : null;
}

// Campo de la API → campo del formulario. `nombre` y `contacto` salen los dos de «Persona de contacto».
const API_FIELDS = {
  email: 'email',
  password: 'password',
  nombre: 'personaContacto',
  contacto: 'personaContacto',
  nombreEmpresa: 'nombreEmpresa',
  cif: 'cif',
  telefono: 'telefono',
  emailContacto: 'emailContacto',
  ciudad: 'ciudad',
};

const isEmail = (value) => EMAIL.test(value.trim());
const cleanPhone = (value) => value.replace(/\s/g, '');

function requiredText(value, message) {
  const text = value.trim();
  if (!text) return message;
  if (text.length > MAX_TEXT) return `Como máximo ${MAX_TEXT} caracteres.`;
  return null;
}

// Errores de los datos de la empresa: { campo: mensaje }. Vacío si todo es correcto.
export function validateCompany(values) {
  const errors = {
    nombreEmpresa: requiredText(values.nombreEmpresa, 'Escribe el nombre de la empresa.'),
    cif: isValidCif(values.cif) ? null : 'Escribe un CIF válido (p. ej. B12345674).',
    telefono: PHONE.test(cleanPhone(values.telefono))
      ? null
      : 'Escribe un teléfono de 9 dígitos que empiece por 6, 7, 8 o 9.',
    personaContacto: requiredText(
      values.personaContacto,
      'Escribe el nombre de la persona de contacto.',
    ),
    emailContacto: isEmail(values.emailContacto) ? null : 'Escribe un email de contacto válido.',
    ciudad: requiredText(values.ciudad, 'Escribe la ciudad.'),
  };
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
}

// Errores de la cuenta de acceso y de la casilla de condiciones.
export function validateAccount(values) {
  const errors = {
    email: isEmail(values.email) ? null : 'Escribe un email válido.',
    password:
      values.password.length >= 8 && values.password.length <= 128
        ? null
        : 'La contraseña debe tener al menos 8 caracteres.',
    password2: values.password2 === values.password ? null : 'Las contraseñas no coinciden.',
    condiciones: values.condiciones ? null : 'Tienes que aceptar las condiciones para continuar.',
  };
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
}

// Traduce los `details` de un VALIDATION_ERROR ([{ field, message }]) a { campo del formulario: mensaje }.
export function apiErrorsToFields(details) {
  const errors = {};
  for (const { field } of details ?? []) {
    const formField = API_FIELDS[field];
    if (formField && !errors[formField]) errors[formField] = FIELD_MESSAGES[formField];
  }
  return errors;
}

// Datos de la empresa para enviar a la API, normalizados como los espera.
export function companyPayload(values) {
  return {
    nombreEmpresa: values.nombreEmpresa.trim(),
    cif: normalizeCif(values.cif),
    telefono: cleanPhone(values.telefono),
    personaContacto: values.personaContacto.trim(),
    emailContacto: values.emailContacto.trim(),
    ciudad: values.ciudad.trim(),
  };
}

// Respuesta de GET /companies/me → valores del formulario.
export function companyToForm(company) {
  return {
    ...EMPTY_COMPANY,
    nombreEmpresa: company?.nombreEmpresa ?? '',
    cif: company?.cif ?? '',
    telefono: company?.telefono ?? '',
    personaContacto: company?.contacto ?? '',
    emailContacto: company?.emailContacto ?? '',
    ciudad: company?.ciudad ?? '',
  };
}
