# Back pendiente para la épica `EMP`

Las issues de la épica `EMP` (Empresa) se maquetan en el front con **datos de prueba** servidos por `src/services/` (UI015), igual que las de `CLI`. Para darlas por terminadas de verdad, la API tiene que ofrecer lo que se lista aquí. Cuando exista, la épica `INT` cambia el interior de cada service y las páginas no se tocan.

Para cada issue se indica qué cubre ya una issue de back y qué falta. Lo que falta todavía no tiene issue: hay que crearla en la épica `DAT` (#3) o en una nueva de back.

Issues de back que ya existen y que usa `EMP`:

| Issue                                                            | Qué da                                                                                                                                 |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| DAT013 (#116) · Registro de empresa y perfil de usuario          | `POST /api/auth/register/company` (cuenta y empresa en un paso, empresa pendiente), `GET /api/companies/me` y `requireApprovedCompany` |
| DAT014 (#117) · Endpoints de empresa: edificios, plantas y salas | Crear, editar y listar edificios; crear y editar plantas; `PATCH /api/company/rooms/:id` con los datos comerciales                     |
| DAT015 (#118) · Guardar y publicar el mapa de una planta         | `PUT /api/company/floors/:id/map`, sincronizar `rooms` y `POST /api/company/floors/:id/publish`                                        |
| DAT016 (#119) · Panel de empresa: reservas y bloqueos            | Listar reservas de sus salas, crear, listar y borrar bloqueos, y cancelar una reserva con motivo                                       |

Todo endpoint nuevo sigue `AGENTS.md` y `CLAUDE.md`: validator, comentario `@openapi` (etiqueta `Empresa` o `Mapas`, `bearerAuth`) y como mínimo un test de permisos (propio 200, ajeno 403, rol cliente 403). El `companyId` sale siempre del token y los endpoints del panel usan `requireApprovedCompany`.

## Decisiones pendientes que afectan al back

1. **Eliminar sala con reservas futuras.** El plan (EMP009) las cancela y las reembolsa; DAT015 (#118) solo marca la sala como no reservable y conserva las reservas.
2. **Pago online y Stripe Connect.** DAT012 (#99) confirma la reserva sin pago online. EMP010 (comprobar la cuenta de cobro), EMP014 (desglose de comisiones y reembolso al cancelar) y EMP015 (cobros) dan por hecho Stripe Connect. Mientras no se decida, en el front son solo maqueta.
3. **Nombres de campos.** DAT013–DAT016 usan nombres en español (`nombreEmpresa`, `cif`, `precioHora`, `fecha`, `inicio`, `fin`) y el [Diseño de datos del README](../README.md#diseño-de-datos) y `AGENTS.md` en inglés (`name`, `taxId`, `price`, `startDate`, `endDate`). Hay que unificarlos antes de `INT`.
4. **Firebase Storage.** El front sube el plano, la fachada y las fotos de sala directamente a Storage (`uploadService`), pero `firebase.json` todavía no tiene reglas de Storage. Hacen falta reglas que solo dejen escribir a la empresa dueña, en su carpeta (`companies/{companyId}/…`), y solo imágenes de tamaño limitado.

## EMP001 · Alta de empresa

- **Ya cubierto (DAT013):** crear la cuenta de acceso y la empresa pendiente en un solo paso, sin sesión; `409 EMAIL_EXISTS` y `409 COMPANY_EXISTS`; `GET /api/companies/me` con el estado.
- **Falta:**
  - Distinguir el email que ya es de un **cliente**: responder un código propio (p. ej. `409 EMAIL_IS_CLIENT`) para que el front muestre «Este email ya tiene una cuenta de cliente. Usa otro para tu empresa.». Decidido el 2026-11-19.
  - Campos del alta que pide el wireframe `10` y no están en DAT013: email de contacto (distinto del de acceso), ciudad y aceptación de las condiciones (con su fecha).
  - En `GET /api/companies/me`: fecha de envío de la solicitud y motivo del rechazo (wireframe `10b`).
  - `PATCH /api/companies/me` para «Editar datos de la solicitud» (pendiente) y «Corregir y reenviar» (rechazada, vuelve a pendiente).
  - Estado `REJECTED` con motivo, que pone el admin (lo usa también ADM).

## EMP002 · Resumen

- **Ya cubierto:** nada.
- **Falta:** `GET /api/company/summary` con:
  - Cifras: edificios, salas publicadas, reservas del mes e ingresos del mes.
  - Próximas reservas (sala, fecha, cliente y estado).
  - Tareas pendientes calculadas en el servidor: plantas sin publicar, salas sin precio y salas sin fotos, cada una con el id del recurso para «Resolver».
  - Señal de primer acceso (sin edificios) para mostrar la bienvenida.

## EMP003 · Mis edificios

- **Ya cubierto (DAT014):** listar sus edificios, crear plantas.
- **Falta:**
  - Que el listado traiga cada edificio con su estado y sus plantas (estado de cada planta y número de salas).
  - Despublicar un edificio (`PATCH` del estado).
  - `DELETE /api/company/buildings/:id`, bloqueado con `409` si alguna sala tiene reservas futuras.
  - Campos de la planta del modal «Añadir planta»: posición en el edificio y «tiene salas».

## EMP004 · Formulario de edificio

- **Ya cubierto (DAT014):** crear y editar edificio y plantas.
- **Falta:**
  - Estado borrador del edificio («Guardar borrador» frente a «Guardar edificio»).
  - Ordenar plantas y eliminar planta (bloqueado si tiene reservas futuras).
  - Campo de la imagen de la fachada (URL y ruta en Storage) y reglas de Storage (decisión 4).

## EMP005 · Zonas de la fachada

- **Falta:** guardar en cada planta su zona sobre la foto de la fachada (rectángulo `x`, `y`, `w`, `h` relativo a la imagen) y devolverla en el detalle público del edificio, que la usa `BuildingHero`.

## EMP006 · _Extra_ Qué hay cerca

- **Falta:** lista de lugares cercanos del edificio (lugar, tipo, minutos a pie, minutos en coche, principal) al crear y editar, y devolverla en el detalle público del edificio (`NearbyMap`).

## EMP007 · Editor I: lienzo

- **Ya cubierto (DAT015):** guardar el mapa. El lienzo es solo front.

## EMP008 · Editor II: plano e IA

- **Ya cubierto:** nada. `mapDetectionService.js`, `mapsController.js`, `config/ai.js` y `rateLimit.js` están creados pero vacíos.
- **Falta:**
  - Guardar la URL del plano en la planta (`mapImageUrl`) y reglas de Storage (decisión 4).
  - `POST /api/company/floors/:id/detect` (rol empresa, planta propia): envía la imagen del plano al modelo con visión, le pide solo JSON con las salas y lo valida con el validator de mapas de DAT015 antes de devolverlo como borrador (`origen: 'ia'`). No guarda nada.
  - Límite estricto de peticiones para la detección (cuesta dinero) y errores claros cuando la IA falla o no devuelve JSON válido.

## EMP009 · Editor III: panel de sala

- **Ya cubierto (DAT014):** editar los datos comerciales de una sala.
- **Falta:**
  - Campos del panel que no están en DAT014: tipo (sala, box, zona común) y m².
  - Reservas futuras de una sala, para avisar antes de eliminarla.
  - Qué pasa con esas reservas al eliminarla (decisión 1).

## EMP010 · Editor IV: guardar y publicar

- **Ya cubierto (DAT015):** guardar borrador y publicar con comprobación (mapa y al menos una sala con precio).
- **Falta:**
  - Que la respuesta de publicar separe **errores** (bloquean) y **avisos** (no bloquean), con el id de la sala afectada para «Revisar».
  - Comprobar la cuenta de cobro de la empresa (decisión 2).

## EMP011 · Salas

- **Ya cubierto (DAT014):** editar una sala.
- **Falta:** `GET /api/company/rooms` con filtros de edificio, planta y estado (publicada, sin precio, oculta), y ocultar o mostrar una sala (una sala sin precio no se puede mostrar: `400`).

## EMP012 · Fotos de sala

- **Ya cubierto (DAT014):** el campo de fotos de la sala.
- **Falta:** orden de las fotos y foto de portada, y reglas de Storage (decisión 4).

## EMP013 · Reservas y bloqueos

- **Ya cubierto (DAT016):** listar reservas con filtros, crear, listar y borrar bloqueos (`409` si pisa una reserva).
- **Falta:**
  - Que el listado de reservas y el de bloqueos se puedan mostrar juntos (o un endpoint que los una) con el estado «Bloqueada».
  - Bloqueos que se repiten (campo de repetición).
  - Filtro por edificio, además de sala y fecha.

## EMP014 · Detalle de reserva

- **Ya cubierto (DAT016):** cancelar con motivo y borrar bloqueo.
- **Falta:**
  - `GET /api/company/bookings/:id` (solo de sus salas): código de reserva (`IP-2041`), sala y planta, fecha, franja, cliente, email del cliente, asistentes e importe.
  - Mensaje opcional para el cliente al cancelar.
  - Desglose de comisiones y reembolso al cancelar (decisión 2).

## EMP015 · Ajustes

- **Ya cubierto (DAT013):** `GET /api/companies/me`.
- **Falta:**
  - Editar los datos de la empresa ya aprobada.
  - Cambiar el email de acceso de la cuenta de empresa (la contraseña la cambia el front con Firebase Auth).
  - Cobros: estado de la cuenta de Stripe Connect y movimientos (decisión 2).

## EMP016 · _Extra_ Edificio 3D

- **Ya cubierto:** el detalle público del edificio con sus plantas (DAT011). No necesita nada nuevo.
