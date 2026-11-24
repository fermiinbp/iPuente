// Precarga de `jose` para Vercel (efecto lateral). Solo la usa api/index.js, que la espera con await
// ANTES de importar la app de forma dinámica: con un import estático, el await no frenaría a los
// módulos vecinos y firebase-admin se cargaría antes.
// firebase-admin → jwks-rsa 4 hace require('jose'), y jose 6 es solo ESM. Node 22 lo admite
// (require de ESM), pero el cargador de funciones de Vercel no y la API se cae al arrancar con
// ERR_REQUIRE_ESM. Aquí se importa jose como ESM y se deja en la caché de require con la misma ruta
// que resolverá jwks-rsa, así su require() la encuentra ya cargada. Si algo falla, no hace nada:
// en local y en los tests Node carga jose por su cuenta.
import Module, { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

try {
  const requireHere = createRequire(import.meta.url);
  const firebaseAuthPath = requireHere.resolve('firebase-admin/auth');
  const jwksPath = createRequire(firebaseAuthPath).resolve('jwks-rsa');
  const josePath = createRequire(jwksPath).resolve('jose');

  if (!Module._cache[josePath]) {
    const jose = await import(pathToFileURL(josePath).href);
    const cached = new Module(josePath);
    cached.filename = josePath;
    cached.loaded = true;
    cached.exports = jose;
    Module._cache[josePath] = cached;
  }
} catch {
  // Sin precarga: Node cargará jose al hacer require (funciona en Node 22 fuera de Vercel).
}
