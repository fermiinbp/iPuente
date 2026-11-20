// Opciones del menú de cuenta por rol (wireframes 24), compartidas por Header y DashboardLayout.
// Cada opción es { label, to?, separated?, desktopOnly? }. Sin `to` se pinta como botón sin destino (solo cierra el menú).
import { ROLES } from './constants.js';

// «Cerrar sesión» no lleva destino: quien pinta el menú le añade `onSelect` con signOutUser().
export const LOGOUT = { label: 'Cerrar sesión', separated: true };

// En empresa y admin el menú solo lleva «Mi cuenta» y «Cerrar sesión».
export const ACCOUNT_ITEMS = {
  [ROLES.CLIENT]: [
    { to: '/my-bookings', label: 'Mis reservas' },
    { to: '/account#datos', label: 'Mis datos' },
    { to: '/account#password', label: 'Cambiar contraseña', desktopOnly: true },
  ],
  [ROLES.COMPANY]: [{ to: '/account', label: 'Mi cuenta' }],
  [ROLES.ADMIN]: [{ to: '/account', label: 'Mi cuenta' }],
};

// Nombre visible de la cuenta: el de Firebase o, si no lo hay, la parte del email antes de la @.
export function displayName(user) {
  return user?.displayName?.trim() || user?.email?.split('@')[0] || 'Mi cuenta';
}
