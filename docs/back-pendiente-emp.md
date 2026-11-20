# Back pendiente para la épica `EMP`

Las issues de la épica `EMP` (Empresa) se maquetan en el front con **datos de prueba** servidos por `src/services/` (UI015), igual que las de `CLI`, salvo cuando la API ya ofrece lo que necesitan: entonces el service llama a la API directamente (EMP001 lo hace así desde el 2026-11-20). Para darlas por terminadas de verdad, la API tiene que ofrecer lo que se lista aquí. Cuando exista, la épica `INT` cambia el interior de cada service y las páginas no se tocan.

Para cada issue se indica qué cubre ya la API en `main` y qué falta. Lo que falta se reparte entre las issues de back abiertas (DAT027–DAT040); si algo no encaja en ninguna, se crea una nueva en la épica `DAT` (#3).

**Revisado contra `main` el 2026-11-20**, tras fusionar las PR #188 (DAT026, que llevó a `main` el back de DAT017–DAT026) y #187 (UI011).

Issues de back que usa `EMP`:

| Issue                                                            | Estado                         | Qué da                                                                                                                                                                                 |
| ---------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DAT013 (#116) · Registro de empresa y perfil de usuario          | Hecho                          | `POST /api/auth/register/company` (cuenta y empresa en un paso, empresa pendiente), `GET /api/companies/me` y `requireApprovedCompany`                                                 |
| DAT014 (#117) · Endpoints de empresa: edificios, plantas y salas | Hecho                          | Crear, editar y listar edificios; crear y editar plantas; `PATCH /api/company/rooms/:id` con los datos comerciales                                                                     |
| DAT015 (#118) · Guardar y publicar el mapa de una planta         | Hecho                          | `PUT /api/company/floors/:id/map`, sincronizar `rooms`, `POST /api/company/floors/:id/publish` y `/unpublish`                                                                          |
| DAT016 (#119) · Panel de empresa: reservas y bloqueos            | Hecho                          | Listar reservas de sus salas (`desde`, `hasta`, `roomId`), crear, listar y borrar bloqueos, y cancelar una reserva con motivo                                                          |
| DAT017 (#147) · Alcance del MVP y contrato de la API             | Hecho                          | Alcance del MVP (reserva confirmada sin pago; Stripe es un extra) e idioma de la API en el [README](../README.md#9-idioma-de-la-api)                                                   |
| DAT018 (#148) · Publicar edificios y gestionar salas             | Hecho                          | Publicar y despublicar edificios (`NO_PUBLISHED_FLOORS`), `GET /api/company/rooms` con filtros y estado (`publicada`, `sin_precio`, `oculta`) y ocultar o mostrar una sala             |
| DAT021 (#151) · Detalle de reserva para cliente y empresa        | Hecho                          | `GET /api/company/bookings/:id` (solo de sus salas)                                                                                                                                    |
| DAT022 (#152) · Admin I: aprobar, rechazar y suspender empresas  | Hecho                          | Aprobar, rechazar con motivo, suspender y reactivar; estados `PENDING`, `APPROVED`, `REJECTED` y `SUSPENDED`; `GET /api/companies/me` con `estado` y `motivo`; claim `companyApproved` |
| DAT024 (#154) · Reglas de Firebase Storage                       | Hecho                          | `storage.rules`: solo escribe la empresa dueña y aprobada en `companies/{companyId}/…`; imágenes PNG, JPEG, WebP o GIF de hasta 5 MB                                                   |
| DAT026 (#156) · Seguridad de la API                              | Hecho                          | Límite de peticiones, CORS y registro más seguro, con `409 EMAIL_IS_CLIENT` si el email del alta ya es de un cliente                                                                   |
| DAT025 (#155) · Detección de salas con IA                        | Cerrada, **no está en `main`** | El código está en la rama `DAT025-deteccion-de-salas-con-ia`, sin PR. La retoma DAT040 (#180), en pausa                                                                                |
| DAT028 (#158) · Eliminar edificio, planta o sala                 | Pendiente                      | Eliminar con las reservas futuras protegidas                                                                                                                                           |
| DAT029 (#159) · Resumen del panel de empresa                     | Pendiente                      | Resumen de EMP002                                                                                                                                                                      |
| DAT030 (#160) · Completar el alta de empresa                     | Pendiente                      | Email de contacto, ciudad y condiciones en el alta, y `PATCH /api/companies/me`                                                                                                        |
| DAT039 (#172) · Salas gratis                                     | Pendiente                      | Elegir entre precio, gratis u oculta                                                                                                                                                   |

Todo endpoint nuevo sigue `AGENTS.md` y `CLAUDE.md`: validator, comentario `@openapi` (etiqueta `Empresa` o `Mapas`, `bearerAuth`) y como mínimo un test de permisos (propio 200, ajeno 403, rol cliente 403). El `companyId` sale siempre del token y los endpoints del panel usan `requireApprovedCompany`.

## Decisiones pendientes que afectan al back

1. **Eliminar sala con reservas futuras.** El plan (EMP009) las cancela y las reembolsa; DAT015 (#118) solo marca la sala como no reservable y conserva las reservas. Lo resuelve DAT028 (#158), abierta.
2. **Pago online y Stripe Connect.** Resuelto: la reserva queda confirmada sin pago; Stripe es el extra 2 del [Alcance del MVP](../README.md#alcance-del-mvp) y Stripe Connect está fuera de alcance. Lo que dependía de ello en EMP010 (comprobar la cuenta de cobro), EMP014 (desglose de comisiones y reembolso al cancelar) y EMP015 (cobros) queda como maqueta en el front.
3. **Nombres de campos.** Resuelto en DAT017: body y respuestas de la API en español (`nombreEmpresa`, `cif`, `precioHora`, `fecha`, `inicio`, `fin`) y Firestore en inglés (`name`, `taxId`, `price`, `startDate`, `endDate`). Equivalencias en el [README](../README.md#9-idioma-de-la-api). Excepción: `GET /api/companies/me` responde con nombres en inglés (`name`, `taxId`, `contactName`, `phone`) salvo `estado` y `motivo`. El front usa los nombres de la API tal cual y solo traduce los textos de pantalla.
4. **Firebase Storage.** Resuelto en DAT024 (#154): `storage.rules` solo deja escribir a la empresa dueña y aprobada en su carpeta, con imágenes de tamaño limitado.
5. **«Contactar con iPuente»** (EMP001, solicitud rechazada). Pendiente de decidir a dónde lleva (email, formulario o página de contacto). El front maqueta el botón sin destino y lo marca con un comentario `TODO`.

## EMP001 · Alta de empresa

- **Ya cubierto en `main`:**
  - `POST /api/auth/register/company` (DAT013): cuenta y empresa pendiente en un solo paso, sin sesión. Body: `email`, `password`, `nombre`, `nombreEmpresa`, `cif`, `contacto` y `telefono`.
  - `409 EMAIL_EXISTS`, `409 COMPANY_EXISTS` y `409 EMAIL_IS_CLIENT` (email que ya es de un cliente; DAT026).
  - `GET /api/companies/me` con `estado` (`pendiente`, `aprobada`, `rechazada` o `suspendida`), `motivo` (de rechazo o suspensión) y `createdAt` (fecha de envío de la solicitud).
  - Rechazo con motivo y suspensión por el admin (DAT022).
- **Falta (DAT030, #160):**
  - Campos del alta que pide el wireframe `10` y la API no acepta: email de contacto (distinto del de acceso), ciudad y aceptación de las condiciones (con su fecha).
  - `PATCH /api/companies/me` para «Editar datos de la solicitud» (pendiente) y «Corregir y reenviar» (rechazada, vuelve a pendiente).
- **Pendiente de decidir:** destino de «Contactar con iPuente» (decisión 5).
- **Front fuera de EMP001:** redirección según el estado de la empresa (EMP017, #190). El token ya lleva el claim `companyApproved`.

## EMP002 · Resumen

- **Ya cubierto:** nada (`GET /api/admin/summary` es solo del admin).
- **Falta (DAT029, #159):** `GET /api/company/summary` con:
  - Cifras: edificios, salas publicadas, reservas del mes e ingresos del mes.
  - Próximas reservas (sala, fecha, cliente y estado).
  - Tareas pendientes calculadas en el servidor: plantas sin publicar, salas sin precio y salas sin fotos, cada una con el id del recurso para «Resolver».
  - Señal de primer acceso (sin edificios) para mostrar la bienvenida.

## EMP003 · Mis edificios

- **Ya cubierto:** listar sus edificios con sus plantas (`plantas: [{ id, numero, nombre, publicado, salas }]`, ordenadas por número), crear plantas, el estado del edificio y publicarlo o despublicarlo (DAT014, DAT018).
- **Falta:**
  - `DELETE /api/company/buildings/:id`, bloqueado si alguna sala tiene reservas futuras (DAT028, #158).
  - Campo «tiene salas» de la planta del modal «Añadir planta» (la posición es `numero`).

## EMP004 · Formulario de edificio

- **Ya cubierto:** crear y editar edificio y plantas (DAT014); el edificio se crea en borrador (`publicado: false`) y se publica aparte (DAT018); fotos del edificio (`fotos`, URLs de Storage) y reglas de Storage (DAT024).
- **Falta:**
  - Eliminar planta, bloqueado si tiene reservas futuras (DAT028, #158). El orden de las plantas es su `numero`.
  - Distinguir la foto de la fachada entre las `fotos` del edificio (p. ej. la primera).

## EMP005 · Zonas de la fachada

- **Falta:** guardar en cada planta su zona sobre la foto de la fachada (rectángulo `x`, `y`, `w`, `h` relativo a la imagen) y devolverla en el detalle público del edificio, que la usa `BuildingHero`.

## EMP006 · _Extra_ Qué hay cerca

- **Falta:** lista de lugares cercanos del edificio (lugar, tipo, minutos a pie, minutos en coche, principal) al crear y editar, y devolverla en el detalle público del edificio (`NearbyMap`).

## EMP007 · Editor I: lienzo

- **Ya cubierto (DAT015):** guardar el mapa. El lienzo es solo front.

## EMP008 · Editor II: plano e IA

- **Ya cubierto:** reglas de Storage para subir el plano (DAT024).
- **Falta:**
  - Guardar la URL del plano en la planta (`mapImageUrl`): `PATCH /api/company/floors/:id` solo acepta `numero` y `nombre`.
  - `POST /api/company/floors/:id/detect`: está hecho en la rama `DAT025-deteccion-de-salas-con-ia` (DAT025, #155, cerrada), pero **no ha llegado a `main`** y no tiene PR. DAT040 (#180) lo retoma más adelante (en pausa).
  - Límite estricto de peticiones para la detección y errores claros cuando la IA falla (también en esa rama).

## EMP009 · Editor III: panel de sala

- **Ya cubierto (DAT014):** editar los datos comerciales de una sala, incluido el m² (`m2`). El tipo se guarda desde el editor de mapas (`tipo` en `salas`, DAT015).
- **Falta (DAT028, #158):**
  - Reservas futuras de una sala, para avisar antes de eliminarla.
  - Qué pasa con esas reservas al eliminarla (decisión 1).

## EMP010 · Editor IV: guardar y publicar

- **Ya cubierto (DAT015):** guardar borrador, publicar con comprobación (mapa y al menos una sala con precio) y despublicar (con `aviso` si era la última planta publicada del edificio).
- **Falta:**
  - Que la respuesta de publicar separe **errores** (bloquean) y **avisos** (no bloquean), con el id de la sala afectada para «Revisar».
  - Comprobar la cuenta de cobro de la empresa (decisión 2).

## EMP011 · Salas

- **Ya cubierto (DAT014, DAT018):** editar una sala, `GET /api/company/rooms` con filtros de edificio, planta y estado (`publicada`, `sin_precio`, `oculta`), y ocultar o mostrar una sala (`PATCH /api/company/rooms/:id/visibility`; una sala sin precio no se puede mostrar: `ROOM_WITHOUT_PRICE`).
- **Relacionado:** salas gratis (DAT039, #172), pendiente.

## EMP012 · Fotos de sala

- **Ya cubierto:** el campo de fotos de la sala (DAT014) y las reglas de Storage (DAT024).
- **Falta:** foto de portada (o acordar que es la primera del array) y confirmar que se respeta el orden al guardar.

## EMP013 · Reservas y bloqueos

- **Ya cubierto (DAT016):** listar reservas con filtros de fechas (`desde`, `hasta`) y sala (`roomId`); crear, listar y borrar bloqueos (`409` si pisa una reserva).
- **Falta:**
  - Que el listado de reservas y el de bloqueos se puedan mostrar juntos (o un endpoint que los una) con el estado «Bloqueada».
  - Bloqueos que se repiten (campo de repetición).
  - Filtro por edificio, además de sala y fecha.

## EMP014 · Detalle de reserva

- **Ya cubierto:** `GET /api/company/bookings/:id` (DAT021), cancelar con motivo y borrar bloqueo (DAT016).
- **Falta:**
  - Comprobar que el detalle trae todo lo del wireframe `15b`: código de reserva (`IP-2041`), planta, email del cliente y asistentes.
  - Mensaje opcional para el cliente al cancelar.
  - Desglose de comisiones y reembolso al cancelar (decisión 2).

## EMP015 · Ajustes

- **Ya cubierto (DAT013, DAT022):** `GET /api/companies/me`.
- **Falta:**
  - Editar los datos de la empresa ya aprobada (DAT030, #160: una empresa aprobada solo edita sus datos de contacto).
  - Cambiar el email de acceso de la cuenta de empresa (la contraseña la cambia el front con Firebase Auth).
  - Cobros: estado de la cuenta de Stripe Connect y movimientos (decisión 2).

## EMP016 · _Extra_ Edificio 3D

- **Ya cubierto:** el detalle público del edificio con sus plantas (DAT011). No necesita nada nuevo.
