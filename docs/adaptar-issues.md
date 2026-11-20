# Adaptar el trabajo del repo a las issues abiertas

Estado a 2026-11-19, rama `feat/edificio-3d-realista` (94 commits por delante de `main`, sin PR).
Se va issue a issue. De momento solo la #3.

## #3 · DAT · Datos y BaaS

**Tipo:** épica (etiquetas `epic` y `DAT`). No tiene código propio: se cierra cuando se cierran sus sub-issues.
Por eso un PR no puede llevar `Closes #3` mientras haya sub-issues abiertas; como mucho `Refs #3`.

### Sub-issues

| # | Issue | Estado en GitHub | Estado en el repo | Archivos / commits que la cubren | Qué falta |
| --- | --- | --- | --- | --- | --- |
| 14 | DAT001 · Modelo de datos | cerrada | completa | README (Diseño de datos), `server/src/models/*` | — |
| 15 | DAT002 · Proyecto Firebase y conexión desde React | cerrada | completa | `client/src/config/firebase.js` | — |
| 51 | DAT006 · Swagger | cerrada | completa | `server/src/config/swagger.js`, `server/tests/integration/docs.test.js` | — |
| 52 | DAT007 · Auth y roles en la API | cerrada | completa | `server/src/middlewares/auth.js`, `requireRole.js`, `server/tests/integration/auth.test.js` | — |
| 68 | DAT008 · Modelos y seed | cerrada | completa | `server/src/models/*`, `server/scripts/seed.js`, tests `models`, `seed`, `demoData` | — |
| 95 | DAT010 · Disponibilidad y solapes | cerrada | completa | commits `72a415c`, `3ddf20d` | — |
| 97 | DAT011 · Endpoints públicos | cerrada | completa | commits `f9d8bc3`, `b3903f5` | — |
| 99 | DAT012 · Reservas del cliente | cerrada | completa | commits `2c2fccc`, `10d4827`, `95df36c` | — |
| 88 | DAT009 · AuthProvider y guardas de ruta | abierta | **parcial** | `client/src/context/AuthProvider.jsx`, `client/src/context/authContext.js`, `client/src/hooks/useAuth.js` (hechos: usuario, rol, `companyId`, `loading`) | `client/src/router/PrivateRoute.jsx` y `client/src/router/RoleRoute.jsx` son solo un comentario; no se aplican en `client/src/App.jsx` (su cabecera dice que se añadirán); falta el indicador de carga y la vuelta a la página pedida tras el login |
| 116 | DAT013 · Registro de empresa y perfil | abierta | **sin empezar** | solo existe `GET /users/me` en `server/src/routes/users.routes.js` | `POST /auth/register/client` y `/company`, `GET /companies/me`, `server/src/middlewares/requireApprovedCompany.js` (no existe), `server/src/validators/userValidator.js` y `companyValidator.js` (vacíos), tests |
| 117 | DAT014 · Endpoints de empresa | abierta | **sin empezar** | `server/src/routes/company.routes.js`, `controllers/companyController.js`, `services/companyService.js` son solo un comentario | todo |
| 118 | DAT015 · Guardar y publicar mapa | abierta | **sin empezar** | `mapsService.js`, `mapsController.js`, `mapValidator.js` y `tests/unit/mapValidator.test.js` son solo un comentario | todo; depende de DAT014 |
| 119 | DAT016 · Reservas y bloqueos de empresa | abierta | **sin empezar** | `blockModel.js` y `occupancyModel.js` ya existen; el resto son stubs | todo; depende de DAT014 |

Resumen: 8 de 13 completas, 1 parcial (DAT009), 4 sin empezar (DAT013 a DAT016).

### Qué cierra la #3
Nada en esta rama la cierra: faltan DAT013 a DAT016 y parte de DAT009.
Lo único cercano a cerrar es DAT009, que es solo front y no necesita código nuevo de API.

### Cambios de otras issues encontrados (se dejan como están)
- La rama `feat/edificio-3d-realista` mezcla muchos commits sin prefijo de issue (`feat:` y `fix:`): edificio 3D, hero con historia, fondo con foco de luz, microinteracciones, selector de plantas. No son de la #3 (encajan con las épicas EMP, UI y CLI).
- Contiene además commits de DIS, SET, UI y CLI mezclados con los de DAT.
- Pendiente sin commitear en el árbol de trabajo: `client/.env.example` modificado, `coral.txt` borrado y `docs/prototipo/` sin seguimiento.

### Notas
- `npm run build -w server` no existe: `server/package.json` no tiene script `build` (la API se ejecuta tal cual; en producción la empaqueta Netlify). El criterio «build pasa en server» no se puede cumplir sin añadir ese script.
- Convención de rama: la skill `flujo-issue` y `AGENTS.md` usan `ID-slug` (`DAT009-authprovider-y-guardas-de-ruta`); este encargo pide `feat/3-<slug>`. Hay que elegir una.

## #3 · Plan de refactor estructural (sin cambios visuales ni de comportamiento)

La #3 es una épica de datos y BaaS («modelo de datos, conexión con Firebase, seguridad y servicios»). Se comprobó la estructura contra `AGENTS.md`.

### Qué se mueve
Nada. No hay ningún archivo origen → destino que mover, separar o renombrar para cumplir la #3:
- `client/src/config/firebase.js` es el único sitio que inicializa Firebase; los componentes pasan por `services/`.
- `server/` ya tiene la capa routes → validators → controllers → services → models; cada archivo de `server/src/` está en `AGENTS.md`.
- Los archivos que `AGENTS.md` lista y no existen son componentes y páginas futuras (UI y CLI). No tienen que ver con la #3.

### Pendiente (exigiría código nuevo, fuera de un refactor)
- `client/src/router/PrivateRoute.jsx` y `RoleRoute.jsx` (solo comentario) y su uso en `client/src/App.jsx` → DAT009 (#88).
- `server/src/routes/auth.routes.js`, `server/src/validators/authValidator.js`, `server/src/middlewares/requireApprovedCompany.js` → DAT013 (#116).
- Rutas, controladores y services de empresa y mapas → DAT014 a DAT016 (#117 a #119).
- Script `build` en `server/package.json`.
