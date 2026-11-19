@AGENTS.md

## Documentación de la API (obligatorio)

- Todo endpoint nuevo lleva encima un comentario `@openapi` con su etiqueta (`Público`, `Auth`, `Cliente`, `Empresa`, `Mapas`, `Pagos` o `Admin`), su `security` (`bearerAuth` si es privado) y sus respuestas (reutiliza `BadRequest`, `Unauthorized`, `Forbidden` y `NotFound`).
- Las rutas se documentan relativas a `/api` (p. ej. `/health`, no `/api/health`).
- Ejemplo a copiar: `server/src/routes/health.routes.js`. Se ve en `http://localhost:3000/api/docs`.
