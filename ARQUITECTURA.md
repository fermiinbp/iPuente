## Arquitectura
 
iPuente es un **monorepo con dos partes**: el front (`client/`) y la API (`server/`), instaladas juntas con npm workspaces y desplegadas juntas en Vercel.
 
```text
Navegador (client/)  ──token──►  API Express (server/)  ──firebase-admin──►  Firestore
   │                                    │
   └── planos y fotos ──► Storage       └──► Stripe · IA con visión
```
 
- **Los datos pasan por la API**, que comprueba el token, el rol y que el recurso pertenece a la empresa. La disponibilidad de cada sala la calcula el servidor al consultarla, a partir de su horario, sus reservas y sus bloqueos. Las imágenes se suben directamente a Firebase Storage.
- **Cada petición a la API sigue el mismo camino:**
```text
routes → auth / requireRole → validator → validate → controller → service → model → Firestore
```
 
| Capa | Hace | Nunca hace |
| --- | --- | --- |
| `routes/` | Define el endpoint y lo documenta con `@openapi` | Lógica |
| `middlewares/` | Token, rol, resultado de la validación, límites de peticiones, errores | Lógica de negocio |
| `validators/` | Comprueba formato y rangos del body, params y query | Consultar la base de datos |
| `controllers/` | Lee `req`, llama al service y responde | Hablar con Firestore |
| `services/` | Reglas de negocio: solapes, precio, propiedad, Stripe, IA | Tocar `req` o `res` |
| `models/` | Lee y escribe una colección de Firestore | Reglas de negocio |
 
- **`app.js` y `server.js` van separados** porque la misma app se usa de tres formas: `server.js` la arranca en local, el servicio `server` de Vercel la ejecuta en producción y los tests la levantan en un puerto libre.
- **Errores:** siempre `{ "error": { "code", "message", "details" } }`. Los códigos (`VALIDATION_ERROR`, `NO_TOKEN`, `FORBIDDEN`, `SLOT_TAKEN`…) están en Swagger.
El modelo de datos (colecciones de Firestore, campos y relaciones) está en el [Diseño de datos del README](./README.md#diseño-de-datos).
 
## Estructura del proyecto
 
```text
ipuente/
├── .claude/
│   ├── agents/
│   │   ├── back.md
│   │   ├── front.md
│   │   ├── orquestador.md
│   │   ├── qa.md
│   │   ├── revisor.md
│   │   └── seguridad.md
│   ├── hooks/
│   │   └── format.js
│   └── settings.json
├── client/
│   ├── src/
│   │   ├── config/
│   │   │   ├── constants.js
│   │   │   └── firebase.js
│   │   ├── services/
│   │   │   ├── adminService.js
│   │   │   ├── apiClient.js
│   │   │   ├── bookingsService.js
│   │   │   ├── buildingsService.js
│   │   │   ├── companyService.js
│   │   │   ├── floorsService.js
│   │   │   ├── paymentsService.js
│   │   │   ├── roomsService.js
│   │   │   └── uploadService.js
│   │   ├── utils/
│   │   │   ├── dates.js
│   │   │   ├── formatPrice.js
│   │   │   └── mapGeometry.js
│   │   ├── assets/
│   │   │   ├── icons/
│   │   │   └── images/
│   │   ├── components/
│   │   │   ├── booking/
│   │   │   │   ├── BookingForm.jsx
│   │   │   │   └── BookingSummary.jsx
│   │   │   ├── building/
│   │   │   │   ├── Building3D.jsx
│   │   │   │   ├── BuildingHero.jsx
│   │   │   │   └── NearbyMap.jsx
│   │   │   ├── floor-plan/
│   │   │   │   ├── FloorPlan.jsx
│   │   │   │   ├── Legend.jsx
│   │   │   │   └── RoomShape.jsx
│   │   │   ├── layout/
│   │   │   │   ├── DashboardLayout.jsx
│   │   │   │   ├── Footer.jsx
│   │   │   │   ├── Header.jsx
│   │   │   │   └── Layout.jsx
│   │   │   ├── map-editor/
│   │   │   │   ├── DetectionOverlay.jsx
│   │   │   │   ├── EditorToolbar.jsx
│   │   │   │   ├── MapEditor.jsx
│   │   │   │   ├── PlanUploader.jsx
│   │   │   │   ├── RoomHandle.jsx
│   │   │   │   └── RoomPropertiesPanel.jsx
│   │   │   ├── room/
│   │   │   │   ├── AvailabilityCalendar.jsx
│   │   │   │   ├── RoomCard.jsx
│   │   │   │   └── RoomSidePanel.jsx
│   │   │   └── ui/
│   │   │       ├── Button.jsx
│   │   │       ├── Input.jsx
│   │   │       ├── Modal.jsx
│   │   │       ├── Spinner.jsx
│   │   │       └── StatusBadge.jsx
│   │   ├── context/
│   │   │   ├── authContext.js
│   │   │   └── AuthProvider.jsx
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── useFetch.js
│   │   │   └── useMapEditor.js
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   │   ├── AdminBookings.jsx
│   │   │   │   ├── AdminCompanies.jsx
│   │   │   │   ├── AdminDashboard.jsx
│   │   │   │   ├── AdminPayments.jsx
│   │   │   │   └── AdminUsers.jsx
│   │   │   ├── company/
│   │   │   │   ├── CompanyBookings.jsx
│   │   │   │   ├── CompanyBuildings.jsx
│   │   │   │   ├── CompanyDashboard.jsx
│   │   │   │   ├── CompanyRegister.jsx
│   │   │   │   ├── CompanyRooms.jsx
│   │   │   │   └── MapEditorPage.jsx
│   │   │   ├── Building.jsx
│   │   │   ├── Floor.jsx
│   │   │   ├── Landing.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── MyBookings.jsx
│   │   │   ├── NotFound.jsx
│   │   │   ├── PaymentResult.jsx
│   │   │   ├── Register.jsx
│   │   │   └── Room.jsx
│   │   ├── router/
│   │   │   ├── AppRouter.jsx
│   │   │   ├── PrivateRoute.jsx
│   │   │   └── RoleRoute.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── styles/
│   │   └── style.css
│   ├── public/
│   │   ├── demo-plans/
│   │   ├── images/
│   │   └── favicon.svg
│   ├── .env.example
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── src/
│   │   ├── config/
│   │   │   ├── ai.js
│   │   │   ├── config.js
│   │   │   ├── stripe.js
│   │   │   └── swagger.js
│   │   ├── routes/
│   │   │   ├── admin.routes.js
│   │   │   ├── bookings.routes.js
│   │   │   ├── buildings.routes.js
│   │   │   ├── company.routes.js
│   │   │   ├── floors.routes.js
│   │   │   ├── index.js
│   │   │   ├── payments.routes.js
│   │   │   ├── rooms.routes.js
│   │   │   ├── users.routes.js
│   │   │   └── webhook.routes.js
│   │   ├── validators/
│   │   │   ├── adminValidator.js
│   │   │   ├── bookingValidator.js
│   │   │   ├── buildingValidator.js
│   │   │   ├── commonValidator.js
│   │   │   ├── companyValidator.js
│   │   │   ├── floorValidator.js
│   │   │   ├── mapValidator.js
│   │   │   ├── roomValidator.js
│   │   │   └── userValidator.js
│   │   ├── middlewares/
│   │   │   ├── auth.js
│   │   │   ├── errorHandler.js
│   │   │   ├── rateLimit.js
│   │   │   ├── requireRole.js
│   │   │   └── validate.js
│   │   ├── controllers/
│   │   │   ├── adminController.js
│   │   │   ├── bookingsController.js
│   │   │   ├── buildingsController.js
│   │   │   ├── companyController.js
│   │   │   ├── floorsController.js
│   │   │   ├── mapsController.js
│   │   │   ├── paymentsController.js
│   │   │   ├── roomsController.js
│   │   │   └── usersController.js
│   │   ├── services/
│   │   │   ├── adminService.js
│   │   │   ├── availabilityService.js
│   │   │   ├── bookingsService.js
│   │   │   ├── buildingsService.js
│   │   │   ├── companyService.js
│   │   │   ├── floorsService.js
│   │   │   ├── mapDetectionService.js
│   │   │   ├── mapsService.js
│   │   │   ├── paymentsService.js
│   │   │   ├── roomsService.js
│   │   │   └── usersService.js
│   │   ├── models/
│   │   │   ├── bookingModel.js
│   │   │   ├── buildingModel.js
│   │   │   ├── companyModel.js
│   │   │   ├── favoriteModel.js
│   │   │   ├── floorModel.js
│   │   │   ├── officeModel.js
│   │   │   ├── paymentModel.js
│   │   │   └── userModel.js
│   │   ├── utils/
│   │   │   ├── asyncHandler.js
│   │   │   ├── dates.js
│   │   │   └── httpError.js
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/
│   │   ├── integration/
│   │   │   ├── auth.test.js
│   │   │   ├── docs.test.js
│   │   │   └── health.test.js
│   │   └── unit/
│   │       ├── availability.test.js
│   │       └── mapValidator.test.js
│   ├── scripts/
│   │   ├── data/
│   │   │   └── users.json
│   │   ├── makeAdmin.js
│   │   └── seed.js
│   ├── .env.example
│   ├── eslint.config.js
│   └── package.json
├── api/
│   └── index.js
├── docs/
│   └── images/
├── .editorconfig
├── .gitignore
├── .prettierignore
├── .prettierrc
├── ARQUITECTURA.md
├── CLAUDE.md
├── README.md
├── firebase.json
├── firestore.indexes.json
├── firestore.rules
├── vercel.json
└── package.json
```
 
## Explicación de cada archivo
 
Es la estructura de partida: los archivos están creados pero vacíos, cada uno con un comentario de una línea que dice para qué es (los `.json` van vacíos porque JSON no admite comentarios). Las carpetas sin archivos llevan un `.gitkeep` para que Git las guarde; se borra en cuanto tengan contenido.
 
### Raíz del proyecto
 
| Archivo | Para qué sirve |
| --- | --- |
| `package.json` | Raíz del monorepo: declara los workspaces `client` y `server` y los scripts globales (`dev`, `build`, `start`, `lint`, `test`, `format`). |
| `vercel.json` | Configuración de Vercel con servicios: `client` (Vite, raíz `client/`, todo a `index.html` para React Router) y `server` (Express, raíz `server/`, entrypoint `src/app.js`); `/api/*` va al servidor con la ruta completa y el resto al front. |
| `.gitignore` | Lo que nunca se sube a Git: dependencias, builds, `.env`, claves de Firebase, logs y ajustes personales de editores y de Claude Code. |
| `.editorconfig` | Mismo formato básico en cualquier editor: UTF-8, 2 espacios, saltos de línea LF. |
| `.prettierrc` | Reglas de Prettier (comillas simples, punto y coma, 100 caracteres) para que los 4 escribamos igual. |
| `.prettierignore` | Carpetas que Prettier no toca. |
| `firebase.json` | Indica a Firebase CLI dónde están las reglas y los índices de Firestore (`npx firebase-tools deploy --only firestore`). Storage se añadirá cuando tenga reglas. |
| `firestore.rules` | Reglas de seguridad de Firestore: el navegador no lee ni escribe directamente (todo pasa por la API, que usa `firebase-admin`). Si el front necesita leer algo, se abre solo esa lectura. |
| `firestore.indexes.json` | Índices compuestos de Firestore que necesitan las consultas de reservas y plantas. |
| `CLAUDE.md` | Instrucciones que Claude Code lee al empezar: qué es el proyecto, qué agente usar y las reglas clave. |
 
### Front: `client/`
 
| Archivo | Para qué sirve |
| --- | --- |
| `client/package.json` | Dependencias y scripts del front (`dev`, `build`, `preview`, `lint`). |
| `client/index.html` | Única página HTML de la web: metadatos, enlace a `styles/style.css` y el `<div id="root">` donde React monta la aplicación. |
| `client/styles/style.css` | Hoja de estilos única de la web, ordenada por secciones: variables, reset, base, layout, componentes, páginas y, al final, media queries y keyframes. |
| `client/public/favicon.svg` | Icono de la pestaña del navegador (provisional hasta tener logo). |
| `client/public/images/` | Imágenes estáticas servidas tal cual (p. ej. `edificio-hero.png`, la imagen del edificio de la landing). |
| `client/public/demo-plans/` | Planos de ejemplo para probar el editor y la detección con IA en la demo. |
| `client/vite.config.js` | Configuración de Vite: plugin de React y alias `@/` que apunta a `client/src`. |
| `client/eslint.config.js` | Reglas de ESLint para React y hooks. |
| `client/.env.example` | Plantilla de variables del front (Firebase web, incluido el bucket de Storage, y URL de la API). Se copia a `.env`. Ninguna es secreta. |
 
### Front: `client/src/` (React)
 
Todo el código de React. `config/` conecta con Firebase; `router/` define las URLs; `context/` y `hooks/` comparten estado; `services/` es la única capa que habla con la API; `components/` son piezas reutilizables y `pages/` las pantallas completas.
 
| Archivo | Para qué sirve |
| --- | --- |
| `client/src/main.jsx` | Punto de entrada de React: monta `<App />` dentro del router y del `AuthProvider`. |
| `client/src/App.jsx` | Componente raíz: de momento solo pinta el router; aquí irían providers o avisos globales. |
| `client/src/config/firebase.js` | Conexión del navegador con Firebase: inicializa la app y exporta `auth` (login) y `storage` (subida de planos y fotos). |
| `client/src/config/constants.js` | Constantes compartidas del front: URL de la API, roles (`CLIENT`, `COMPANY`, `ADMIN`), estados de sala, de reserva y de pago, y horario reservable. |
| `client/src/router/AppRouter.jsx` | Mapa de rutas de la web: públicas, de cliente, de empresa y de admin, cada grupo protegido por su guarda. |
| `client/src/router/PrivateRoute.jsx` | Guarda de ruta: si no hay sesión, redirige a `/login`. Solo oculta pantallas; la seguridad real está en la API. |
| `client/src/router/RoleRoute.jsx` | Guarda de ruta por rol (`COMPANY` o `ADMIN`): si el usuario no lo tiene, vuelve a la home. |
| `client/src/context/authContext.js` | Crea el contexto de autenticación (separado del provider para que Vite haga fast refresh). |
| `client/src/context/AuthProvider.jsx` | Escucha la sesión de Firebase y expone a toda la app el usuario, su rol (`CLIENT`, `COMPANY`, `ADMIN`) y su `companyId`. |
| `client/src/hooks/useAuth.js` | Hook para leer el usuario y su rol desde cualquier componente. |
| `client/src/hooks/useMapEditor.js` | Estado y acciones del editor de mapas: salas, selección, dibujar, mover, redimensionar, borrar, deshacer y cargar el borrador de la IA. |
| `client/src/hooks/useFetch.js` | Hook genérico para llamar a un service y gestionar `data`, `loading` y `error` en las pantallas. |
| `client/src/services/apiClient.js` | Cliente HTTP único: añade el token de Firebase a cada petición y convierte los errores de la API (`{ error: { code, message } }`) en excepciones. |
| `client/src/services/buildingsService.js` | Llamadas públicas de edificios: listado y detalle con sus plantas. |
| `client/src/services/floorsService.js` | Llamada pública del mapa de una planta con el estado de cada sala en una fecha. |
| `client/src/services/roomsService.js` | Ficha de sala y huecos libres. |
| `client/src/services/bookingsService.js` | Reservas del cliente: crear, listar y cancelar. |
| `client/src/services/paymentsService.js` | Pide a la API la URL de Stripe Checkout de una reserva. |
| `client/src/services/companyService.js` | Panel de empresa: alta, edificios, plantas, detección con IA, guardar y publicar mapas, salas, reservas y bloqueos. |
| `client/src/services/adminService.js` | Panel de admin: empresas, usuarios, reservas, pagos y reembolsos. |
| `client/src/services/uploadService.js` | Sube planos y fotos directamente a Firebase Storage y devuelve su URL y su ruta. |
| `client/src/components/ui/Button.jsx` | Botón reutilizable con variantes primario, secundario y fantasma. |
| `client/src/components/ui/Input.jsx` | Campo de formulario con etiqueta, ayuda y mensaje de error. |
| `client/src/components/ui/Modal.jsx` | Ventana modal accesible (cierre con Escape y foco atrapado). |
| `client/src/components/ui/Spinner.jsx` | Indicador de carga. |
| `client/src/components/ui/StatusBadge.jsx` | Etiqueta de estado: de una sala (libre, ocupada, no reservable), de una reserva (`PENDING_PAYMENT`, `CONFIRMED`…) o de una empresa (verificada o pendiente). |
| `client/src/components/layout/Header.jsx` | Cabecera: logo, navegación, acceso y menú según el rol. |
| `client/src/components/layout/Footer.jsx` | Pie de página. |
| `client/src/components/layout/DashboardLayout.jsx` | Plantilla con menú lateral para los paneles de empresa y admin. |
| `client/src/components/building/BuildingHero.jsx` | Imagen del edificio con una banda clicable por planta (hover ilumina la planta y muestra las salas libres). |
| `client/src/components/building/Building3D.jsx` | Extra: edificio 3D generado a partir de las plantas guardadas (Three.js). |
| `client/src/components/building/NearbyMap.jsx` | Sección «Qué hay cerca»: mapa ilustrado con puntos de interés (estación de tren, metro, parking…) y tiempos. |
| `client/src/components/floor-plan/FloorPlan.jsx` | Plano SVG de una planta para clientes, generado desde el `mapData` de la planta y coloreado por el estado de cada sala. |
| `client/src/components/floor-plan/RoomShape.jsx` | Una sala del plano: rectángulo con código y nombre, clicable y accesible con teclado. |
| `client/src/components/floor-plan/Legend.jsx` | Leyenda de estados del plano (con texto, no solo color). |
| `client/src/components/map-editor/MapEditor.jsx` | Lienzo del editor: plano de fondo y salas editables encima. |
| `client/src/components/map-editor/EditorToolbar.jsx` | Herramientas del editor: seleccionar, dibujar, borrar, deshacer, detectar con IA y guardar. |
| `client/src/components/map-editor/RoomHandle.jsx` | Sala editable con tiradores para mover y redimensionar. |
| `client/src/components/map-editor/RoomPropertiesPanel.jsx` | Panel lateral con los datos de la sala seleccionada (código, nombre, tipo). |
| `client/src/components/map-editor/PlanUploader.jsx` | Subida de la imagen del plano (arrastrar o seleccionar). |
| `client/src/components/map-editor/DetectionOverlay.jsx` | Estado «Analizando tu plano…» con animación de escaneo mientras responde la IA. |
| `client/src/components/room/RoomCard.jsx` | Tarjeta resumen de una sala (foto, nombre, capacidad, precio). |
| `client/src/components/room/RoomSidePanel.jsx` | Panel lateral que se abre al pulsar una sala del plano. |
| `client/src/components/room/AvailabilityCalendar.jsx` | Huecos libres de una sala por día. |
| `client/src/components/booking/BookingForm.jsx` | Formulario de reserva: fecha y franja horaria (`startDate` y `endDate`). |
| `client/src/components/booking/BookingSummary.jsx` | Resumen de la reserva con el precio que devuelve la API. |
| `client/src/components/layout/Layout.jsx` | Plantilla común de las páginas públicas: cabecera, contenido (`<Outlet />`) y pie. |
| `client/src/pages/Landing.jsx` | Home: hero con el edificio por plantas, buscador, salas destacadas, cómo funciona y llamada a empresas. |
| `client/src/pages/Building.jsx` | Página de un edificio: plantas, salas libres y «Qué hay cerca». |
| `client/src/pages/Floor.jsx` | Página de una planta: plano, selector de fecha y panel de sala. |
| `client/src/pages/Room.jsx` | Ficha de sala con galería, equipamiento, disponibilidad y reserva. |
| `client/src/pages/Login.jsx` | Inicio de sesión con email o Google. |
| `client/src/pages/Register.jsx` | Registro de cliente. |
| `client/src/pages/MyBookings.jsx` | Reservas del cliente: próximas y pasadas, con cancelación. |
| `client/src/pages/PaymentResult.jsx` | Vuelta desde Stripe: reserva confirmada o pago cancelado. |
| `client/src/pages/NotFound.jsx` | Página 404. |
| `client/src/pages/company/CompanyDashboard.jsx` | Resumen del panel de empresa. |
| `client/src/pages/company/CompanyRegister.jsx` | Solicitud de alta como empresa (queda pendiente de aprobación). |
| `client/src/pages/company/CompanyBuildings.jsx` | Edificios y plantas de la empresa. |
| `client/src/pages/company/MapEditorPage.jsx` | Página del editor de mapas de una planta: subir plano, detectar, corregir, guardar y publicar. |
| `client/src/pages/company/CompanyRooms.jsx` | Datos comerciales de las salas: precio, capacidad, equipamiento y fotos. |
| `client/src/pages/company/CompanyBookings.jsx` | Reservas de las salas de la empresa y bloqueo de horas. |
| `client/src/pages/admin/AdminDashboard.jsx` | Resumen del panel de admin. |
| `client/src/pages/admin/AdminCompanies.jsx` | Aprobar o suspender empresas. |
| `client/src/pages/admin/AdminUsers.jsx` | Usuarios y cambio de rol. |
| `client/src/pages/admin/AdminBookings.jsx` | Todas las reservas. |
| `client/src/pages/admin/AdminPayments.jsx` | Pagos y reembolsos. |
| `client/src/utils/formatPrice.js` | Formatea importes en euros (`25` → `25,00 €`). |
| `client/src/utils/dates.js` | Utilidades de fechas: formato `AAAA-MM-DD`, horas y rangos para el calendario. |
| `client/src/utils/mapGeometry.js` | Cálculos del editor: escalar coordenadas, ajustar a la rejilla y limitar las salas al plano. |
| `client/src/assets/icons/` | Iconos SVG importados desde componentes (equipamiento, estación, metro…). |
| `client/src/assets/images/` | Imágenes importadas desde componentes (las que pasan por Vite). |
 
### Back: `server/` (configuración y scripts)
 
| Archivo | Para qué sirve |
| --- | --- |
| `server/package.json` | Dependencias y scripts de la API (`dev`, `start`, `lint`, `test`, `seed`, `make-admin`). |
| `server/eslint.config.js` | Reglas de ESLint para Node. |
| `server/.env.example` | Plantilla de variables secretas de la API (Firebase Admin, Stripe, IA, URL de la web, puerto). Se copia a `.env` y nunca se sube. |
| `server/scripts/makeAdmin.js` | Script para convertir en admin a un usuario ya registrado (`npm run make-admin -w server -- correo@ejemplo.com`). |
| `server/scripts/seed.js` | Carga datos de demo (usuarios en Auth, empresas, edificio, plantas, salas, reservas y bloqueo) a partir de `scripts/data/`. Necesita `SEED_DEMO_PASSWORD`. |
| `server/scripts/data/users.json` | Usuarios demo del seed (uid fijo, email `@ipuente.test`, nombre, rol y `companyId`). |
 
### Back: `server/src/config/`
 
| Archivo | Para qué sirve |
| --- | --- |
| `server/src/config/config.js` | Configuración del backend y conexión a la base de datos: lee y valida las variables de entorno y conecta con Firebase (Firestore y Auth) mediante `firebase-admin`. |
| `server/src/config/swagger.js` | Documentación de la API con Swagger: genera la especificación OpenAPI leyendo los comentarios `@openapi` de las rutas y la sirve en `/api/docs`. |
| `server/src/config/stripe.js` | Cliente de Stripe (modo test) creado con la clave secreta. |
| `server/src/config/ai.js` | Cliente del modelo de IA con visión (Anthropic) que detecta las salas en los planos. |
 
### Back: `server/src/routes/`
 
Cada archivo define los endpoints de un recurso y los documenta con un comentario `@openapi` encima de cada ruta. El orden de cada línea es siempre: ruta → `auth` / `requireRole` → validator → `validate` → controlador.
 
| Archivo | Para qué sirve |
| --- | --- |
| `server/src/routes/buildings.routes.js` | Rutas públicas de edificios: listado de edificios publicados y detalle con sus plantas. |
| `server/src/routes/floors.routes.js` | Ruta pública del mapa de una planta con el estado de cada sala en una fecha. |
| `server/src/routes/rooms.routes.js` | Rutas públicas de salas: ficha y horas libres. |
| `server/src/routes/bookings.routes.js` | Rutas de reservas del cliente: crear, listar las propias y cancelar. |
| `server/src/routes/payments.routes.js` | Rutas de pago del cliente: crea la sesión de Stripe Checkout. El webhook va en `webhook.routes.js`. |
| `server/src/routes/webhook.routes.js` | Ruta del webhook de Stripe: recibe el body sin parsear para verificar la firma y confirma la reserva pagada. |
| `server/src/routes/users.routes.js` | Rutas del perfil del usuario autenticado. |
| `server/src/routes/company.routes.js` | Rutas del panel de empresa: alta, edificios, plantas, mapas (detección con IA, guardar, publicar), salas, reservas y bloqueos. Cada empresa solo accede a lo suyo. |
| `server/src/routes/admin.routes.js` | Rutas del panel de admin: empresas, usuarios, reservas, pagos y reembolsos. |
| `server/src/routes/index.js` | Une todas las rutas bajo `/api` (excepto el webhook y la documentación, que se montan en `app.js`). |
 
### Back: `server/src/validators/`
 
Reglas de `express-validator`: un archivo por recurso y un export por endpoint (`bookingValidator.create`). Comprueban formato y rangos; las reglas que necesitan la base de datos (solapes, propiedad) van en los services.
 
| Archivo | Para qué sirve |
| --- | --- |
| `server/src/validators/commonValidator.js` | Reglas reutilizables: id en la URL, fecha `AAAA-MM-DD` en la query y franja horaria. |
| `server/src/validators/bookingValidator.js` | Validación de reservas: crear (`officeId`, `startDate`, `endDate`), cancelar y checkout de pago. |
| `server/src/validators/userValidator.js` | Validación del perfil de usuario. |
| `server/src/validators/companyValidator.js` | Validación del panel de empresa: alta, edificios, plantas, datos de sala y bloqueos. |
| `server/src/validators/mapValidator.js` | Validación de mapas: URL del plano para la IA, JSON del mapa (dimensiones y salas dentro del plano) y publicación. |
| `server/src/validators/adminValidator.js` | Validación del panel de admin: aprobar o suspender empresas (`verified`) y cambio de rol. |
| `server/src/validators/buildingValidator.js` | Validación de edificios públicos: id en la URL y fecha opcional del detalle. |
| `server/src/validators/floorValidator.js` | Validación del mapa público de una planta: id en la URL y fecha opcional. |
| `server/src/validators/roomValidator.js` | Validación de salas públicas: id en la URL y fecha opcional para la disponibilidad. |
 
### Back: `server/src/middlewares/`
 
| Archivo | Para qué sirve |
| --- | --- |
| `server/src/middlewares/auth.js` | Verifica el token de Firebase de la cabecera `Authorization` y deja en `req.user` el `uid`, el rol y el `companyId`. |
| `server/src/middlewares/requireRole.js` | Corta la petición con `403` si el rol del usuario no es uno de los permitidos. |
| `server/src/middlewares/validate.js` | Recoge el resultado de los validators de `express-validator` y, si hay errores, responde `400 VALIDATION_ERROR` con el detalle por campo. |
| `server/src/middlewares/errorHandler.js` | Respuesta de error única `{ error: { code, message, details } }` y 404 para rutas que no existen. Oculta el detalle de los 500. |
| `server/src/middlewares/rateLimit.js` | Límites de peticiones: uno general para la API y otro estricto para la detección con IA (cuesta dinero). |
 
### Back: `server/src/controllers/`
 
Un controlador por recurso, con un método por endpoint. Leen `req`, llaman al service y responden.
 
| Archivo | Para qué sirve |
| --- | --- |
| `server/src/controllers/buildingsController.js` | Controlador de edificios públicos. Lee `req`, llama al service y responde; nunca habla con Firestore. |
| `server/src/controllers/floorsController.js` | Controlador del mapa público de una planta. Lee `req`, llama al service y responde; nunca habla con Firestore. |
| `server/src/controllers/roomsController.js` | Controlador de fichas y disponibilidad de salas. Lee `req`, llama al service y responde; nunca habla con Firestore. |
| `server/src/controllers/bookingsController.js` | Controlador de reservas del cliente. Lee `req`, llama al service y responde; nunca habla con Firestore. |
| `server/src/controllers/paymentsController.js` | Controlador de pagos: checkout de Stripe y webhook. Lee `req`, llama al service y responde; nunca habla con Firestore. |
| `server/src/controllers/usersController.js` | Controlador del perfil de usuario. Lee `req`, llama al service y responde; nunca habla con Firestore. |
| `server/src/controllers/companyController.js` | Controlador del panel de empresa: alta, edificios, plantas, salas, reservas y bloqueos. Lee `req`, llama al service y responde; nunca habla con Firestore. |
| `server/src/controllers/mapsController.js` | Controlador de mapas: detección con IA, guardar y publicar. Lee `req`, llama al service y responde; nunca habla con Firestore. |
| `server/src/controllers/adminController.js` | Controlador del panel de admin. Lee `req`, llama al service y responde; nunca habla con Firestore. |
 
### Back: `server/src/services/`
 
| Archivo | Para qué sirve |
| --- | --- |
| `server/src/services/availabilityService.js` | Reglas de disponibilidad: calcula las horas libres de una sala (horario reservable 8–20) a partir de sus reservas `CONFIRMED` y sus `blocks`, el estado de una sala en un día (`FREE`, `OCCUPIED` o `UNAVAILABLE`) y detecta solapes (`nuevoInicio < existenteFin && nuevoFin > existenteInicio`) dentro de una transacción de Firestore. |
| `server/src/services/bookingsService.js` | Crear, listar y cancelar reservas; calcula en el servidor `price`, `pricePeriod` y `totalAmount` a partir del `price` de la sala. |
| `server/src/services/paymentsService.js` | Crea sesiones de Stripe Checkout, procesa el webhook (firma verificada) y hace reembolsos. |
| `server/src/services/mapDetectionService.js` | Envía la imagen del plano a la IA con visión, le pide solo JSON con las salas detectadas (nombre, código, posición y tamaño) y lo valida antes de devolverlo como borrador de `mapData`. |
| `server/src/services/mapsService.js` | Guarda el `mapData` de una planta, sincroniza la colección `offices` (crea, conserva o desactiva salas) y publica. |
| `server/src/services/companyService.js` | Alta de empresas, edificios y plantas; comprueba que cada recurso pertenece a la empresa del usuario. |
| `server/src/services/usersService.js` | Perfil de usuario y asignación de rol (`CLIENT`, `COMPANY`, `ADMIN`) mediante custom claims (`role`, `companyId`). |
| `server/src/services/adminService.js` | Aprobación y suspensión de empresas y listados globales. |
| `server/src/services/buildingsService.js` | Edificios públicos: listado de publicados y detalle con sus plantas y las salas libres de cada una en una fecha. Nunca devuelve quién reservó. |
| `server/src/services/floorsService.js` | Mapa público de una planta publicada: sus salas con estado (`FREE`, `OCCUPIED`, `UNAVAILABLE`), capacidad y precio en una fecha. |
| `server/src/services/roomsService.js` | Ficha pública de una sala y sus horas libres de un día (8–20); `404` si la sala, su planta o su edificio no están publicados. |
 
### Back: `server/src/models/`
 
Un archivo por colección de Firestore. Es la única capa que importa la base de datos (`db()` de `config/config.js`). Los campos de cada colección están en el [Diseño de datos del README](./README.md#diseño-de-datos).
 
| Archivo | Para qué sirve |
| --- | --- |
| `server/src/models/userModel.js` | Acceso a la colección `users` (id = UID de Firebase Auth). Campos: name, surname, email, phone, role (`CLIENT` \| `COMPANY` \| `ADMIN`), createdAt, updatedAt. |
| `server/src/models/companyModel.js` | Acceso a la colección `companies` y a su subcolección `members` (userId, role `OWNER` \| `MANAGER` \| `EMPLOYEE`, joinedAt). Campos: name, legalName, taxId, description, logoUrl, email, phone, address, verified, createdAt, updatedAt. |
| `server/src/models/buildingModel.js` | Acceso a la colección `buildings`. Campos: companyId, name, description, address, city, postalCode, country, latitude, longitude, floorCount, status, createdAt, updatedAt. |
| `server/src/models/floorModel.js` | Acceso a la colección `floors`. Campos: buildingId, name, level, mapImageUrl, mapData (cada sala con su id, posición, anchura, altura y enlace a `offices`; formato por concretar con el editor), status, createdAt, updatedAt. |
| `server/src/models/officeModel.js` | Acceso a la colección `offices` (las salas) y a sus subcolecciones `blocks` (startDate, endDate, reason) e `images` (url, storagePath, order, isCover). Campos: companyId, buildingId, floorId, name, code, description, surface, capacity, price, pricePeriod (`HOUR`), amenities, status, openingHours, createdAt, updatedAt. |
| `server/src/models/bookingModel.js` | Acceso a la colección `bookings`. Campos: userId, companyId, officeId, startDate, endDate, price, pricePeriod, totalAmount, status (`PENDING_PAYMENT` \| `CONFIRMED` \| `CANCELLED` \| `EXPIRED` \| `COMPLETED`), paymentId, createdAt, updatedAt. |
| `server/src/models/paymentModel.js` | Acceso a la colección `payments`. Campos: bookingId, userId, amount, currency (`EUR`), provider (`STRIPE`), providerPaymentId, status (`PENDING` \| `SUCCEEDED` \| `FAILED` \| `REFUNDED`), createdAt, updatedAt. |
| `server/src/models/favoriteModel.js` | Acceso a la colección `favorites`: salas guardadas por cada usuario. Estructura por definir; relaciona un usuario con una sala. |
 
### Back: `server/src/utils/`, `app.js` y `server.js`
 
| Archivo | Para qué sirve |
| --- | --- |
| `server/src/utils/httpError.js` | Clase `HttpError(status, code, message)` para lanzar errores con código HTTP desde cualquier capa. |
| `server/src/utils/asyncHandler.js` | Envuelve controladores `async` para que sus errores lleguen al `errorHandler`. |
| `server/src/utils/dates.js` | Utilidades de fechas: validar `AAAA-MM-DD` (fecha real del calendario), `todayString` y `dayRange` (rango de un día en hora local). |
| `server/src/app.js` | Configura Express sin arrancarlo: CORS, límite de peticiones, webhook de Stripe (body sin parsear), JSON, `/api/health`, documentación Swagger en `/api/docs`, rutas y manejo de errores. Lo usan `server.js`, la función de Vercel y los tests. |
| `server/src/server.js` | Arranca la API en local con `app.listen`. En producción no se usa: Vercel ejecuta `app.js` como función del servicio `server` (`vercel.json`). |
 
### Tests: `server/tests/`
 
| Archivo | Para qué sirve |
| --- | --- |
| `server/tests/integration/health.test.js` | Test de integración: la API arranca y `GET /api/health` responde `{ ok: true }`. |
| `server/tests/integration/auth.test.js` | Test de integración: las rutas privadas sin token devuelven `401` y las validaciones devuelven `400` con el formato de error común. |
| `server/tests/integration/docs.test.js` | Test de integración: la especificación OpenAPI se genera y documenta todas las rutas. |
| `server/tests/integration/buildings.test.js` | Test de integración de `GET /api/buildings` y `/buildings/:id` con Firestore sustituido por un doble: solo publicados, salas libres por planta, 404 y 400. |
| `server/tests/integration/floors.test.js` | Test de integración de `GET /api/floors/:id`: estado de cada sala (`FREE`, `OCCUPIED`, `UNAVAILABLE`) en una fecha, 404 y 400. |
| `server/tests/integration/rooms.test.js` | Test de integración de `GET /api/rooms/:id` y `/rooms/:id/availability`: ficha, horas libres de 8 a 20, 404 y 400; ninguna respuesta incluye datos de clientes. |
| `server/tests/helpers/publicData.js` | Datos de prueba de los endpoints públicos (edificios, plantas, salas, reservas y un bloqueo) y utilidades para levantar la app y hacer peticiones. |
| `server/tests/unit/availability.test.js` | Tests unitarios de las reglas de disponibilidad: solapes, bordes de franja, horas libres y `assertSlotAvailable` con models dobles. |
| `server/tests/unit/mapValidator.test.js` | Tests unitarios del validator de mapas: rechaza salas fuera del plano o con tipo inválido. |
 
### Documentación: `docs/`
 
| Archivo | Para qué sirve |
| --- | --- |
| `docs/images/` | Capturas, diagramas exportados y material para la presentación. |
 
### Claude Code: `.claude/` y `CLAUDE.md`
 
| Archivo | Para qué sirve |
| --- | --- |
| `.claude/settings.json` | Configuración compartida de Claude Code: qué comandos puede ejecutar sin preguntar, cuáles pregunta y cuáles tiene prohibidos (leer `.env`, `push --force`…), y el hook de formato. |
| `.claude/hooks/format.js` | Hook que pasa Prettier por cada archivo que edita Claude. |
| `.claude/agents/orquestador.md` | Agente que planifica: divide la tarea, fija el contrato del endpoint y asigna cada paso a un agente. |
| `.claude/agents/back.md` | Agente backend: trabaja solo en `server/` siguiendo las capas y las reglas de negocio. |
| `.claude/agents/front.md` | Agente frontend: trabaja solo en `client/` con CSS propio y accesibilidad. |
| `.claude/agents/seguridad.md` | Agente de seguridad: audita roles, reglas, pagos, IA y secretos; solo propone. |
| `.claude/agents/qa.md` | Agente de calidad: escribe y ejecuta tests y comprueba los criterios de aceptación. |
| `.claude/agents/revisor.md` | Agente revisor: revisa el diff antes de cada commit; solo comenta. |
 
## Convenciones y flujo de trabajo
 
| Qué | Convención | Ejemplo |
| --- | --- | --- |
| Componentes React | `PascalCase.jsx` | `RoomCard.jsx` |
| Hooks | `useCamelCase.js` | `useMapEditor.js` |
| Resto de archivos JS | `camelCase.js` | `bookingsService.js` |
| Rutas, validators y controladores | `recurso.routes.js`, `recursoValidator.js`, `recursoController.js` | `bookings.routes.js` |
| Carpetas | minúsculas, `kebab-case` | `map-editor/` |
| Variables de entorno | `MAYUSCULAS_CON_GUIONES` | `STRIPE_SECRET_KEY` |
| CSS | Todo en `client/styles/style.css`; clases para estilos e `id` para JavaScript; `@media` y `@keyframes` al final | — |
| Ramas | `CÓDIGO-titulo-de-la-issue`, creada desde la issue | `SET003-eslint-prettier-y-convencion-de` |
| Commits | `CÓDIGO: descripción` | `SET003: configura ESLint y Prettier` |
 
- `main` está protegida: todo entra por Pull Request revisada por otra persona del equipo.
- Cada endpoint nuevo lleva su validator, su comentario `@openapi` y, como mínimo, un test de permisos.
- El detalle de ramas, commits, Pull Requests, ESLint y Prettier está en el [README](./README.md#convenciones-de-trabajo).
- Lo que sobra se mueve a `_to_delete/` y se avisa; no se borra por cuenta propia.
## Documentación
 
- **API:** se documentará con Swagger desde los comentarios `@openapi` de las rutas y se verá en `/api/docs`.
- [README](./README.md): idea, roles, historias de usuario, alcance del MVP y convenciones de trabajo.
- [Instrucciones para Claude Code](./CLAUDE.md) y agentes en `.claude/agents/`.

## Wireframes

Diseño completo en [Figma](https://www.figma.com/design/jS9ZKB4ddrw9MfYfZn6xKR).

![Flujo de pantallas](./docs/images/wireframes/00-flujo.png)
