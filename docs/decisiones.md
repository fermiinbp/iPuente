# Registro de decisiones

Cada decisión de arquitectura se apunta aquí: fecha, qué se decidió y por qué. Las nuevas van arriba.

| Fecha | Decisión | Motivo |
| --- | --- | --- |
| 2026-11-10 | Estructura rehecha: `client/` con `index.html` y `styles/style.css` (una sola hoja de estilos) y `server/src/` con `config/` (`config.js` y `swagger.js`), `routes`, `controllers`, `validators`, `middlewares`, `services`, `models` y `utils` | Requisitos del equipo y estructura estándar de Express |
| 2026-11-10 | Validación con `express-validator` en `validators/` + middleware `validate` | Reglas declarativas por endpoint y mensajes en español; los services solo reciben datos válidos |
| 2026-11-10 | Documentación de la API con Swagger (`swagger-jsdoc` + `swagger-ui-express`) a partir de comentarios `@openapi` en las rutas, servida en `/api/docs` | La documentación vive junto al código y no se desincroniza; sustituye a `docs/api.md` |
| 2026-11-10 | `config/config.js` centraliza variables de entorno y la conexión con Firestore | Un único punto de configuración y conexión a la base de datos |
| 2026-11-10 | Límite de peticiones general y otro estricto para la detección con IA | La IA se paga por uso |
| 2026-11-09 | El 3D a partir de una foto del edificio queda fuera; el edificio 3D se generará a partir de las plantas guardadas (extra) | Los servicios de IA de foto a 3D devuelven un bloque sin plantas separadas y no permiten hacer clic por planta |
| 2026-11-09 | La detección de salas con IA solo genera un borrador editable; el editor manual es la base | La precisión depende del plano; el editor garantiza que siempre haya mapa |
| 2026-11-09 | La IA se llama desde la API (`mapDetectionService`), nunca desde el navegador | La clave de la API no puede estar en el front |
| 2026-11-09 | Las imágenes se suben directamente a Cloudinary desde el navegador | Evita el límite de 6 MB por petición de Netlify Functions |
| 2026-11-09 | El mapa de cada planta se guarda como JSON en `floors.salas`; los datos comerciales, en `rooms` con el mismo id | El mismo JSON alimenta el plano, el editor y el 3D |
| 2026-11-09 | Tres roles (`client`, `company`, `admin`) como *custom claims* del token, con `companyId` para las empresas | Las reglas de Firestore y la API los leen sin consultar la base de datos |
| 2026-11-09 | Colección `occupancy` con solo las horas ocupadas | El plano necesita la ocupación en tiempo real y las reservas tienen datos personales |
| 2026-11-09 | Monorepo con npm workspaces: `client/` y `server/` | Un solo `npm install` y un solo despliegue |
| 2026-11-09 | Backend en Express por capas, publicado como una única Netlify Function con `serverless-http` | Estructura estándar que evalúa el bootcamp, sin pagar ni mantener un servidor |
| 2026-11-09 | Pagos a una sola cuenta de Stripe en modo test; Stripe Connect fuera de alcance | Cobrar a cada empresa por separado es un proyecto en sí mismo |
| 2026-11-05 | Firebase (Auth + Firestore) en lugar de Supabase | Autenticación resuelta, tiempo real y modelo sencillo; menos configuración para un proyecto corto |
| 2026-11-04 | Despliegue en Netlify | Web y funciones en el mismo sitio y gratis |
| 2026-11-04 | React + Vite en el front | Se ve en el bootcamp y el profesorado lo permite |
