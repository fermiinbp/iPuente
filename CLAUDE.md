# iPuente · instrucciones para Claude Code

Portal donde las empresas publican sus oficinas (plano → mapa interactivo, con detección de salas por IA) y los clientes alquilan salas por horas. Proyecto final en equipo del bootcamp.

## Lee antes de tocar nada

- `README.md`: alcance del MVP, roles, historias de usuario (HU-01 a HU-13), diseño de datos (colecciones y campos de Firestore) y convenciones de trabajo.
- `ARQUITECTURA.md`: estructura, capas, explicación de cada archivo y convenciones de código.
- `/api/docs` (Swagger, generado desde los `@openapi` de `server/src/routes/`): contrato de la API.

## Cómo trabajamos con agentes

Los agentes viven en `.claude/agents/`:

| Agente | Cuándo |
| --- | --- |
| `orquestador` | Primero, en cualquier tarea que toque más de un archivo o de una capa. Devuelve un plan con el agente de cada paso |
| `back` | `server/` y `netlify/functions/` |
| `front` | `client/` |
| `seguridad` | Cuando se toca auth, roles, `firestore.rules`, pagos, subida de archivos, IA, variables de entorno o dependencias |
| `qa` | Después de implementar: tests y criterios de aceptación |
| `revisor` | Al final, antes de cada commit |

Flujo: `orquestador` → `back` / `front` → `seguridad` (si aplica) → `qa` → `revisor`. Los subagentes no pueden llamar a otros subagentes: la sesión principal sigue el plan del orquestador y delega cada paso.

## Reglas clave

- Backend: `routes → validators → controllers → services → models`. Solo `models/` habla con Firestore. Cada endpoint con su validator y su `@openapi`.
- El navegador nunca escribe en Firestore; todo pasa por la API.
- Precio y solapes de reservas, siempre en el servidor. Cada empresa solo toca lo suyo (`companyId`).
- CSS propio sin frameworks, en `client/styles/style.css`; `@media` y `@keyframes` al final.
- Nunca leas ni edites `.env`. Nunca hagas push a `main`.
- Ramas `CÓDIGO-titulo-de-la-issue` (p. ej. `SET003-eslint-prettier-y-convencion-de`); commits `CÓDIGO: descripción`. Detalle en el README, sección «Convenciones de trabajo».
- `npm run lint` sin errores antes de cada commit.

## Comandos

`npm run lint` · `npm run lint:fix` · `npm run format` · `npm run format:check`. `dev`, `build` y `test` se añaden cuando se monten el front y la API.
