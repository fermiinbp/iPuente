// Roles de usuario de la API (custom claim `role` de Firebase Auth), los mismos que usa el front.
export const ROLES = Object.freeze({
  CLIENT: 'CLIENT',
  COMPANY: 'COMPANY',
  ADMIN: 'ADMIN',
});

// Lista de roles válidos, para validar claims y argumentos.
export const ROLE_VALUES = Object.freeze(Object.values(ROLES));
