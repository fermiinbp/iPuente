// Opciones del menú de cuenta por rol (wireframes 24), compartidas por Header y DashboardLayout.
// Cada opción es { label, to?, separated?, desktopOnly? }. Sin `to` se pinta como botón sin destino (solo cierra el menú).
import { ROLES } from './constants.js';

// TODO(CLI001): «Cerrar sesión» debe llamar a logout() de services/authService.js (signOut de Firebase).
export const LOGOUT = { label: 'Cerrar sesión', separated: true };

// En empresa y admin el menú solo lleva «Mi cuenta» y «Cerrar sesión».
// TODO(CLI013): enlazar «Mis datos», «Cambiar contraseña» y «Mi cuenta» a la página de cuenta (p. ej. /account).
export const ACCOUNT_ITEMS = {
  [ROLES.CLIENT]: [
    { to: '/my-bookings', label: 'Mis reservas' },
    { label: 'Mis datos' },
    { label: 'Cambiar contraseña', desktopOnly: true },
  ],
  [ROLES.COMPANY]: [{ label: 'Mi cuenta' }],
  [ROLES.ADMIN]: [{ label: 'Mi cuenta' }],
};

// Nombre visible de la cuenta: el de Firebase o, si no lo hay, la parte del email antes de la @.
export function displayName(user) {
  return user?.displayName?.trim() || user?.email?.split('@')[0] || 'Mi cuenta';
}
