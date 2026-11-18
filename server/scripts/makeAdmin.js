// Script para convertir en admin a un usuario ya registrado (npm run make-admin -w server -- correo@ejemplo.com).
// Uso (desde server/): node --env-file=.env scripts/makeAdmin.js correo@ejemplo.com
import { ROLES } from '../src/config/roles.js';
import { setUserRole } from '../src/services/usersService.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  const email = process.argv[2]?.trim();
  if (!email || !EMAIL_REGEX.test(email)) {
    console.error('Uso: npm run make-admin -w server -- correo@ejemplo.com');
    process.exit(1);
  }

  const user = await setUserRole(email, ROLES.ADMIN);
  console.log(`Hecho: ${user.email} (uid ${user.uid}) ahora tiene el rol ${user.role}.`);
  console.log(
    'Para ver el nuevo rol, el usuario debe cerrar sesión y volver a entrar (o refrescar el token con getIdToken(true)).',
  );
}

main().catch((err) => {
  if (err.code === 'auth/user-not-found') {
    console.error('No existe ningún usuario con ese correo. Debe registrarse antes en la web.');
  } else {
    console.error('Error al asignar el rol de admin:', err.message);
  }
  process.exit(1);
});
