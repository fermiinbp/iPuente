# AGENTS.md

## Proyecto
[iPuente]: Las empresas publican sus oficinas: suben la imagen del plano, una IA detecta las salas como borrador y lo corrigen en un editor de mapas.Los clientes exploran el edificio por plantas, ven en un plano 2D las salas libres con precio, capacidad y equipamiento, y reservan y pagan online; roles: cliente, empresa y admin. React + Vite, React Router y Firebase como BaaS.

## Estructura
| Archivo | Para qué sirve |
| --- | --- |
| `package.json` | Raíz del monorepo: declara los workspaces `client` y `server` y los scripts globales (`dev`, `build`, `start`, `lint`, `test`, `format`). |
| `netlify.toml` | Configuración de Netlify: construye `client/`, publica `client/dist`, despliega la API como función y redirige `/api/*` a ella y el resto a `index.html` (React Router). |
| `.gitignore` | Lo que nunca se sube a Git: dependencias, builds, `.env`, claves de Firebase, logs y ajustes personales de editores y de Claude Code. |
| `.editorconfig` | Mismo formato básico en cualquier editor: UTF-8, 2 espacios, saltos de línea LF. |
| `.prettierrc` | Reglas de Prettier (comillas simples, punto y coma, 100 caracteres) para que los 4 escribamos igual. |
| `.prettierignore` | Carpetas que Prettier no toca. |
| `firebase.json` | Indica a Firebase CLI dónde están las reglas y los índices de Firestore (`npx firebase-tools deploy --only firestore`). Storage se añadirá cuando tenga reglas. |
| `firestore.rules` | Reglas de seguridad de Firestore: el navegador no lee ni escribe directamente (todo pasa por la API, que usa `firebase-admin`). Si el front necesita leer algo, se abre solo esa lectura. |
| `firestore.indexes.json` | Índices compuestos de Firestore que necesitan las consultas de reservas y plantas. |
| `netlify/functions/api.js` | Única Netlify Function: envuelve la app de Express (`server/src/app.js`) con `serverless-http` para que la API funcione en Netlify sin servidor propio. |
| `CLAUDE.md` | Instrucciones que Claude Code lee al empezar: qué es el proyecto, qué agente usar y las reglas clave. |
 
### Front: `client/`
 
| Archivo | Para qué sirve |
| --- | --- |
| `client/package.json` | Dependencias y scripts del front (`dev`, `build`, `preview`, `lint`). |
| `client/index.html` | Única página HTML de la web: metadatos, enlace a `styles/style.css` y el `<div id="root">` donde React monta la aplicación. |
| `client/styles/style.css` | Estilos globales de la web: variables en `:root`, reset y estilos base. Los estilos de cada componente van en su `.module.css`. |
| `client/public/favicon.svg` | Icono de la pestaña del navegador (provisional hasta tener logo). |
| `client/public/images/` | Imágenes estáticas servidas tal cual (p. ej. `edificio-hero.png`, la imagen del edificio de la landing). |
| `client/public/demo-plans/` | Planos de ejemplo para probar el editor y la detección con IA en la demo. |
| `client/vite.config.js` | Configuración de Vite: plugin de React y alias `@/` que apunta a `client/src`. |
| `client/eslint.config.js` | Reglas de ESLint para React y hooks. |
| `client/.env.example` | Plantilla de variables del front (Firebase web, incluido el bucket de Storage, y URL de la API). Se copia a `.env`. Ninguna es secreta. |
 
### Front: `client/src/` (React)
 
Todo el código de React. `config/` conecta con Firebase; `App.jsx` define las URLs y `router/` guarda las guardas de ruta; `context/` y `hooks/` comparten estado; `services/` es la única capa que habla con la API; `components/` son piezas reutilizables y `pages/` las pantallas completas.
 
| Archivo | Para qué sirve |
| --- | --- |
| `client/src/main.jsx` | Punto de entrada de React: monta `<App />` dentro del router y del `AuthProvider`. |
| `client/src/App.jsx` | Componente raíz y mapa de rutas de la web (React Router): públicas, de cliente, de empresa y de admin, anidadas en `Layout` (y las de empresa y admin, además, en `DashboardLayout`). |
| `client/src/config/firebase.js` | Conexión del navegador con Firebase: inicializa la app y exporta `auth` (login) y `storage` (subida de planos y fotos). |
| `client/src/config/constants.js` | Constantes compartidas del front: URL de la API, roles (`CLIENT`, `COMPANY`, `ADMIN`), estados de sala, de reserva y de pago, y horario reservable. |
| `client/src/router/PrivateRoute.jsx` | Guarda de ruta: si no hay sesión, redirige a `/login`. Solo oculta pantallas; la seguridad real está en la API. |
| `client/src/router/RoleRoute.jsx` | Guarda de ruta por rol (`COMPANY` o `ADMIN`): si el usuario no lo tiene, vuelve a la home. |
| `client/src/context/authContext.js` | Crea el contexto de autenticación (separado del provider para que Vite haga fast refresh). |
| `client/src/context/AuthProvider.jsx` | Escucha la sesión de Firebase y expone a toda la app el usuario, su rol (`CLIENT`, `COMPANY`, `ADMIN`) y su `companyId`. |
| `client/src/hooks/useAuth.js` | Hook para leer el usuario y su rol desde cualquier componente. |
| `client/src/hooks/useMapEditor.js` | Estado y acciones del editor de mapas: salas, selección, dibujar, mover, redimensionar, borrar, deshacer y cargar el borrador de la IA. |
| `client/src/hooks/useFetch.js` | Hook genérico para llamar a un service y gestionar `data`, `loading` y `error` en las pantallas. |
| `client/src/services/apiClient.js` | Cliente HTTP único: añade el token de Firebase a cada petición y convierte los errores de la API (`{ error: { code, message } }`) en excepciones. |
| `client/src/services/healthService.js` | Lectura de comprobación: llama a `/api/health` a través de `apiClient`. |
| `client/src/services/buildingsService.js` | Llamadas públicas de edificios: listado y detalle con sus plantas. |
| `client/src/services/floorsService.js` | Llamada pública del mapa de una planta con el estado de cada sala en una fecha. |
| `client/src/services/roomsService.js` | Ficha de sala y huecos libres. |
| `client/src/services/bookingsService.js` | Reservas del cliente: crear, listar y cancelar. |
| `client/src/services/paymentsService.js` | (extra) Pide a la API la URL de Stripe Checkout de una reserva. |
| `client/src/services/companyService.js` | Panel de empresa: alta, edificios, plantas, detección con IA, guardar y publicar mapas, salas, reservas y bloqueos. |
| `client/src/services/adminService.js` | Panel de admin: empresas, usuarios, reservas, pagos y reembolsos. |
| `client/src/services/uploadService.js` | Sube planos y fotos directamente a Firebase Storage y devuelve su URL y su ruta. |
| `client/src/components/ui/Button/Button.jsx` + `.module.css` | Botón reutilizable con variantes primario, secundario y fantasma, tamaños `md` (44 px) y `lg` (52 px), `loading` y `disabled`; con `to` funciona como enlace. |
| `client/src/components/ui/IconButton/IconButton.jsx` + `.module.css` | Botón solo con icono y `aria-label` obligatorio (barra del editor, cerrar paneles y modales, menú móvil). |
| `client/src/components/ui/BackLink/BackLink.jsx` + `.module.css` | Enlace «← Volver a…» con la flecha decorativa (`aria-hidden`). |
| `client/src/components/ui/Input/Input.jsx` + `.module.css` | Campo de formulario con etiqueta, ayuda y mensaje de error. |
| `client/src/components/ui/Modal/Modal.jsx` + `.module.css` | Ventana modal accesible (cierre con Escape y foco atrapado). |
| `client/src/components/ui/Spinner/Spinner.jsx` + `.module.css` | Indicador de carga. |
| `client/src/components/ui/StatusBadge/StatusBadge.jsx` + `.module.css` | Etiqueta de estado: de una sala (libre, ocupada, no reservable; en el panel de empresa: publicada, sin precio, oculta), de una reserva (`CONFIRMED`, `CANCELLED`…; `PENDING_PAYMENT` solo con el extra de Stripe), de un pago o de una empresa (verificada, pendiente, rechazada o suspendida). |
| `client/src/components/ui/Select/Select.jsx` + `.module.css` | Desplegable con etiqueta, ayuda y mensaje de error (buscador, filtros, cambio de rol). |
| `client/src/components/ui/Textarea/Textarea.jsx` + `.module.css` | Texto largo con etiqueta y error (motivo de rechazo, suspensión, cancelación o bloqueo). |
| `client/src/components/ui/Checkbox/Checkbox.jsx` + `.module.css` | Casilla con etiqueta (equipamiento, aceptar condiciones). |
| `client/src/components/ui/Chip/Chip.jsx` + `.module.css` | Píldora pequeña: filtro seleccionable por tipo de sala o etiqueta informativa (`Black Room I · 25 €/h`). |
| `client/src/components/ui/Avatar/Avatar.jsx` + `.module.css` | Círculo con la foto o las iniciales del usuario. |
| `client/src/components/ui/Alert/Alert.jsx` + `.module.css` | Mensaje de error, aviso o éxito dentro de una pantalla. |
| `client/src/components/ui/EmptyState/EmptyState.jsx` + `.module.css` | Estado vacío con título, texto y acciones (sin resultados, sin edificios, sin reservas). |
| `client/src/components/ui/StatCard/StatCard.jsx` + `.module.css` | Cifra destacada con título para los resúmenes de empresa y admin. |
| `client/src/components/ui/ConfirmModal/ConfirmModal.jsx` + `.module.css` | Modal de confirmación sobre `Modal`: título, texto, motivo opcional y acción (cancelar reserva, rechazar o suspender empresa, reembolsar, eliminar sala). |
| `client/src/components/ui/DataTable/DataTable.jsx` + `.module.css` | Tabla de los paneles: columnas, acciones por fila y estado vacío; en móvil pasa a tarjetas. |
| `client/src/components/ui/FilterBar/FilterBar.jsx` + `.module.css` | Fila de filtros (edificio, planta, estado, fechas) encima de las tablas. |
| `client/src/components/ui/FileDropzone/FileDropzone.jsx` + `.module.css` | Zona para arrastrar o seleccionar archivos; la usan `PlanUploader` y las fotos de sala. |
| `client/src/components/ui/CookieBanner/CookieBanner.jsx` + `.module.css` | Aviso de cookies que recuerda la elección del usuario. |
| `client/src/components/ui/ErrorState/ErrorState.jsx` + `.module.css` | Error del servidor o sin conexión, con botón de reintentar. |
| `client/src/components/layout/Header/Header.jsx` + `.module.css` | Cabecera: logo, navegación, acceso y menú según el rol. |
| `client/src/components/layout/UserMenu/UserMenu.jsx` + `.module.css` | Menú desplegable del usuario en escritorio (reservas, panel según rol, cerrar sesión). |
| `client/src/components/layout/MobileMenu/MobileMenu.jsx` + `.module.css` | Menú de navegación a pantalla completa en móvil. |
| `client/src/components/layout/Footer/Footer.jsx` + `.module.css` | Pie de página. |
| `client/src/components/layout/DashboardLayout/DashboardLayout.jsx` + `.module.css` | Plantilla con menú lateral para los paneles de empresa y admin. |
| `client/src/components/search/SearchBar/SearchBar.jsx` + `.module.css` | Buscador de ciudad, fecha y personas (landing y resultados). |
| `client/src/components/search/CategoryFilters/CategoryFilters.jsx` + `.module.css` | Filtros por tipo de sala (reuniones, eventos, formación, boxes privados). |
| `client/src/components/search/BuildingCard/BuildingCard.jsx` + `.module.css` | Tarjeta de edificio en los resultados: foto, dirección, salas libres y precio desde. |
| `client/src/components/search/SearchMap/SearchMap.jsx` + `.module.css` | Extra: mapa de resultados con un pin por edificio, resaltado al pasar por su tarjeta. |
| `client/src/components/building/BuildingHero/BuildingHero.jsx` + `.module.css` | Imagen del edificio con una banda clicable por planta (hover ilumina la planta y muestra las salas libres). |
| `client/src/components/building/FloorSelector/FloorSelector.jsx` + `.module.css` | Lista de plantas del edificio con sus salas libres, para elegir planta. |
| `client/src/components/building/Building3D/Building3D.jsx` + `.module.css` | Extra: edificio 3D generado a partir de las plantas guardadas (Three.js). |
| `client/src/components/building/NearbyMap/NearbyMap.jsx` + `.module.css` | Sección «Qué hay cerca»: mapa ilustrado con puntos de interés (estación de tren, metro, parking…) y tiempos. |
| `client/src/components/floor-plan/FloorPlan/FloorPlan.jsx` + `.module.css` | Plano SVG de una planta para clientes, generado desde los campos `ancho`, `alto` y `salas` de la planta y coloreado por el estado de cada sala. |
| `client/src/components/floor-plan/RoomShape/RoomShape.jsx` + `.module.css` | Una sala del plano: rectángulo con código y nombre, clicable y accesible con teclado. |
| `client/src/components/floor-plan/Legend/Legend.jsx` + `.module.css` | Leyenda de estados del plano (con texto, no solo color). |
| `client/src/components/map-editor/MapEditor/MapEditor.jsx` + `.module.css` | Lienzo del editor: plano de fondo y salas editables encima. |
| `client/src/components/map-editor/EditorToolbar/EditorToolbar.jsx` + `.module.css` | Herramientas del editor: seleccionar, dibujar, borrar, deshacer, detectar con IA y guardar. |
| `client/src/components/map-editor/RoomHandle/RoomHandle.jsx` + `.module.css` | Sala editable con tiradores para mover y redimensionar. |
| `client/src/components/map-editor/RoomPropertiesPanel/RoomPropertiesPanel.jsx` + `.module.css` | Panel lateral con los datos de la sala seleccionada (código, nombre, tipo). |
| `client/src/components/map-editor/PlanUploader/PlanUploader.jsx` + `.module.css` | Subida de la imagen del plano (arrastrar o seleccionar). |
| `client/src/components/map-editor/DetectionOverlay/DetectionOverlay.jsx` + `.module.css` | Estado «Analizando tu plano…» con animación de escaneo mientras responde la IA. |
| `client/src/components/map-editor/EditorStartChoice/EditorStartChoice.jsx` + `.module.css` | Elección inicial del editor: detectar salas con IA o dibujarlas a mano. |
| `client/src/components/map-editor/DetectionError/DetectionError.jsx` + `.module.css` | Aviso de fallo en la detección con IA, con opción de reintentar o dibujar a mano. |
| `client/src/components/map-editor/UnsavedChangesModal/UnsavedChangesModal.jsx` + `.module.css` | Aviso al salir del editor con cambios sin guardar. |
| `client/src/components/map-editor/PublishValidationModal/PublishValidationModal.jsx` + `.module.css` | Comprobaciones antes de publicar una planta (salas sin nombre, sin precio…). |
| `client/src/components/company/BuildingFormModal/BuildingFormModal.jsx` + `.module.css` | Formulario para crear o editar un edificio. |
| `client/src/components/company/BuildingMenu/BuildingMenu.jsx` + `.module.css` | Menú de acciones de un edificio: editar, añadir planta y eliminar. |
| `client/src/components/company/FloorList/FloorList.jsx` + `.module.css` | Plantas de un edificio con su estado y acceso al editor de mapas. |
| `client/src/components/company/RoomEditPanel/RoomEditPanel.jsx` + `.module.css` | Panel para editar los datos comerciales de una sala: precio, capacidad, equipamiento y horario. |
| `client/src/components/company/RoomPhotosManager/RoomPhotosManager.jsx` + `.module.css` | Subida, orden y portada de las fotos de una sala. |
| `client/src/components/company/BlockHoursModal/BlockHoursModal.jsx` + `.module.css` | Modal para bloquear horas de una sala (fecha, franja y motivo). |
| `client/src/components/admin/RoleSelect/RoleSelect.jsx` + `.module.css` | Selector para cambiar el rol de un usuario. |
| `client/src/components/room/RoomCard/RoomCard.jsx` + `.module.css` | Tarjeta resumen de una sala (foto, nombre, capacidad, precio). |
| `client/src/components/room/RoomSidePanel/RoomSidePanel.jsx` + `.module.css` | Panel lateral que se abre al pulsar una sala del plano. |
| `client/src/components/room/RoomGallery/RoomGallery.jsx` + `.module.css` | Galería de fotos de la sala. |
| `client/src/components/room/AmenitiesList/AmenitiesList.jsx` + `.module.css` | Equipamiento de la sala con icono y texto. |
| `client/src/components/room/AvailabilityCalendar/AvailabilityCalendar.jsx` + `.module.css` | Huecos libres de una sala por día. |
| `client/src/components/booking/BookingForm/BookingForm.jsx` + `.module.css` | Formulario de reserva: fecha y franja horaria (`startDate` y `endDate`). |
| `client/src/components/booking/BookingSummary/BookingSummary.jsx` + `.module.css` | Resumen de la reserva con el precio que devuelve la API. |
| `client/src/components/booking/BookingCard/BookingCard.jsx` + `.module.css` | Fila de una reserva en «Mis reservas»: sala, fecha, importe y estado. |
| `client/src/components/booking/BookingDetail/BookingDetail.jsx` + `.module.css` | Detalle de una reserva, común a cliente, empresa y admin; cada rol ve sus acciones. |
| `client/src/components/layout/Layout/Layout.jsx` + `.module.css` | Plantilla común de las páginas públicas: cabecera, contenido (`<Outlet />`) y pie. |
| `client/src/pages/Landing/Landing.jsx` + `.module.css` | Home: hero con el edificio por plantas, buscador, salas destacadas, cómo funciona y llamada a empresas. |
| `client/src/pages/Landing/LandingLoader/LandingLoader.jsx` + `.module.css` | Pantalla de carga de la Landing: el monograma «iP» se abre como una puerta; se puede saltar. |
| `client/src/pages/Landing/FloorSection/FloorSection.jsx` + `.module.css` | Sección de la Landing con una planta: lista de salas, detalle de la seleccionada y plano 3D. |
| `client/src/pages/Landing/NearbySection/NearbySection.jsx` + `.module.css` | Sección «Alrededor del edificio» de la Landing: mapa 3D de los puntos cercanos y lista accesible con sus tiempos. |
| `client/src/pages/Landing/HowItWorks/HowItWorks.jsx` + `.module.css` | Sección «Cómo funciona» de la Landing: tres pasos numerados. |
| `client/src/pages/Landing/CompaniesCta/CompaniesCta.jsx` + `.module.css` | Sección «¿Tienes oficinas?» de la Landing: pasos, botón «Publica tu oficina» e ilustración del editor. |
| `client/src/pages/Landing/*.js` | Datos de prueba de la Landing (edificio, plantas, salas destacadas, plano y lugares cercanos) hasta que los sirvan los services. |
| `client/src/pages/Search/Search.jsx` + `.module.css` | Resultados de búsqueda: edificios con salas libres según ciudad, fecha y personas, con filtros y estado sin resultados. |
| `client/src/pages/Building/Building.jsx` + `.module.css` | Página de un edificio: plantas, salas libres y «Qué hay cerca». |
| `client/src/pages/Floor/Floor.jsx` + `.module.css` | Página de una planta: plano, selector de fecha y panel de sala. |
| `client/src/pages/Room/Room.jsx` + `.module.css` | Ficha de sala con galería, equipamiento, disponibilidad y reserva. |
| `client/src/pages/Login/Login.jsx` + `.module.css` | Inicio de sesión con email o Google. |
| `client/src/pages/Register/Register.jsx` + `.module.css` | Registro de cliente. |
| `client/src/pages/ForgotPassword/ForgotPassword.jsx` + `.module.css` | Recuperar contraseña: pide el email y envía el enlace. |
| `client/src/pages/ResetPassword/ResetPassword.jsx` + `.module.css` | Recuperar contraseña: formulario de nueva contraseña desde el enlace. |
| `client/src/pages/MyBookings/MyBookings.jsx` + `.module.css` | Reservas del cliente: próximas y pasadas, con cancelación. |
| `client/src/pages/BookingDetailPage/BookingDetailPage.jsx` + `.module.css` | Detalle de una reserva del cliente, con cancelación. |
| `client/src/pages/PaymentResult/PaymentResult.jsx` + `.module.css` | (extra) Vuelta desde Stripe: reserva confirmada, pago cancelado o reserva expirada. |
| `client/src/pages/NotFound/NotFound.jsx` + `.module.css` | Página 404. |
| `client/src/pages/company/CompanyDashboard/CompanyDashboard.jsx` + `.module.css` | Resumen del panel de empresa, con estado vacío en el primer acceso (sin edificios). |
| `client/src/pages/company/CompanyRegister/CompanyRegister.jsx` + `.module.css` | Solicitud de alta como empresa (queda pendiente de aprobación). |
| `client/src/pages/company/CompanyRequestStatus/CompanyRequestStatus.jsx` + `.module.css` | Estado de la solicitud de alta: en revisión o rechazada con su motivo. |
| `client/src/pages/company/CompanyBuildings/CompanyBuildings.jsx` + `.module.css` | Edificios y plantas de la empresa. |
| `client/src/pages/company/MapEditorPage/MapEditorPage.jsx` + `.module.css` | Página del editor de mapas de una planta: subir plano, detectar, corregir, guardar y publicar. |
| `client/src/pages/company/CompanyRooms/CompanyRooms.jsx` + `.module.css` | Datos comerciales de las salas: precio, capacidad, equipamiento y fotos; estados y ocultar o mostrar sala. |
| `client/src/pages/company/CompanyBookings/CompanyBookings.jsx` + `.module.css` | Reservas de las salas de la empresa y bloqueo de horas. |
| `client/src/pages/company/CompanyBookingDetail/CompanyBookingDetail.jsx` + `.module.css` | Detalle de una reserva de la empresa, con cancelación. |
| `client/src/pages/company/CompanySettings/CompanySettings.jsx` + `.module.css` | Ajustes de la empresa: cobros con Stripe Connect. |
| `client/src/pages/admin/AdminDashboard/AdminDashboard.jsx` + `.module.css` | Resumen del panel de admin. |
| `client/src/pages/admin/AdminCompanies/AdminCompanies.jsx` + `.module.css` | Aprobar, rechazar o suspender empresas. |
| `client/src/pages/admin/AdminCompanyDetail/AdminCompanyDetail.jsx` + `.module.css` | Detalle de una empresa: datos, edificios y acciones de aprobar, rechazar o suspender. |
| `client/src/pages/admin/AdminUsers/AdminUsers.jsx` + `.module.css` | Usuarios y cambio de rol. |
| `client/src/pages/admin/AdminBookings/AdminBookings.jsx` + `.module.css` | Todas las reservas. |
| `client/src/pages/admin/AdminBookingDetail/AdminBookingDetail.jsx` + `.module.css` | Detalle de cualquier reserva. |
| `client/src/pages/admin/AdminPayments/AdminPayments.jsx` + `.module.css` | Pagos y reembolsos. |
| `client/src/utils/formatPrice.js` | Formatea importes en euros (`25` → `25,00 €`). |
| `client/src/utils/dates.js` | Utilidades de fechas: formato `AAAA-MM-DD`, horas y rangos para el calendario. |
| `client/src/utils/mapGeometry.js` | Cálculos del editor: escalar coordenadas, ajustar a la rejilla y limitar las salas al plano. |
| `client/src/assets/icons/` | Iconos SVG importados desde componentes (equipamiento, estación, metro…). |
| `client/src/assets/images/` | Imágenes importadas desde componentes (las que pasan por Vite). |
 
### Back: `server/` (configuración y scripts)
 
| Archivo | Para qué sirve |
| --- | --- |
| `server/package.json` | Dependencias y scripts de la API (`dev`, `start`, `lint`, `test`, `seed`, `make-admin`, `get-token`). |
| `server/eslint.config.js` | Reglas de ESLint para Node. |
| `server/.env.example` | Plantilla de variables secretas de la API (Firebase Admin, Stripe, IA, URL de la web, puerto). Se copia a `.env` y nunca se sube. |
| `server/scripts/makeAdmin.js` | Script para convertir en admin a un usuario ya registrado (`npm run make-admin -w server -- correo@ejemplo.com`). |
| `server/scripts/getToken.js` | Hace login con email y contraseña (`accounts:signInWithPassword` con `FIREBASE_WEB_API_KEY`) e imprime el ID token para probar la API en `/api/docs` (`npm run get-token -w server -- correo contraseña`). |
| `server/scripts/seed.js` | Carga datos de demo en Firestore (empresa, edificio, plantas con su mapa, salas y unas reservas confirmadas) a partir de `scripts/data/`. Idempotente: ids fijos y `set` con `merge` (`npm run seed -w server`). |
| `server/scripts/data/demo-floor.json` | Ejemplo de mapa de planta en el formato que usan el editor, el plano y la API. Sirve para el seed y para probar el front sin backend. |
 
### Back: `server/src/config/`
 
| Archivo | Para qué sirve |
| --- | --- |
| `server/src/config/config.js` | Configuración del backend y conexión a la base de datos: lee y valida las variables de entorno y conecta con Firebase (Firestore y Auth) mediante `firebase-admin`. |
| `server/src/config/bookingHours.js` | `BOOKING_HOURS`: horario reservable (8–20) que comparten los services y los validators. |
| `server/src/config/roles.js` | Roles de usuario (`CLIENT`, `COMPANY`, `ADMIN`) del custom claim `role`, los mismos que en el front. |
| `server/src/config/swagger.js` | Documentación de la API con Swagger: genera la especificación OpenAPI leyendo los comentarios `@openapi` de las rutas y la sirve en `/api/docs`. |
| `server/src/config/stripe.js` | (extra) Cliente de Stripe (modo test) creado con la clave secreta. |
| `server/src/config/ai.js` | Cliente del modelo de IA con visión (Anthropic) que detecta las salas en los planos. |
 
### Back: `server/src/routes/`
 
Cada archivo define los endpoints de un recurso y los documenta con un comentario `@openapi` encima de cada ruta. El orden de cada línea es siempre: ruta → `auth` / `requireRole` → validator → `validate` → controlador.
 
| Archivo | Para qué sirve |
| --- | --- |
| `server/src/routes/health.routes.js` | Ruta pública `GET /api/health` para comprobar que la API responde. Es el ejemplo de comentario `@openapi` para el resto de rutas. |
| `server/src/routes/auth.routes.js` | Rutas públicas de registro: `POST /api/auth/register/client` y `/register/company` (la empresa queda pendiente de aprobación). |
| `server/src/routes/buildings.routes.js` | Rutas públicas de edificios: listado de edificios publicados y detalle con sus plantas. |
| `server/src/routes/floors.routes.js` | Ruta pública del mapa de una planta con el estado de cada sala en una fecha y, con `hora` (8–19), a esa hora. |
| `server/src/routes/rooms.routes.js` | Rutas públicas de salas: ficha y horas libres. |
| `server/src/routes/bookings.routes.js` | Rutas de reservas del cliente: crear, listar las propias y cancelar. |
| `server/src/routes/payments.routes.js` | (extra) Rutas de pago del cliente: crea la sesión de Stripe Checkout. El webhook va en `webhook.routes.js`. |
| `server/src/routes/webhook.routes.js` | (extra) Ruta del webhook de Stripe: recibe el body sin parsear para verificar la firma y confirma la reserva pagada. |
| `server/src/routes/users.routes.js` | Rutas del perfil del usuario autenticado. |
| `server/src/routes/company.routes.js` | Rutas del panel de empresa: alta, edificios, plantas, mapas (detección con IA, guardar, publicar), salas, reservas y bloqueos. Cada empresa solo accede a lo suyo. |
| `server/src/routes/maps.routes.js` | Rutas de mapas de planta de la empresa: `PUT /api/company/floors/:id/map` (guardar) `POST /api/company/floors/:id/publish` (publicar) y `POST /api/company/floors/:id/unpublish` (despublicar). |
| `server/src/routes/admin.routes.js` | Rutas del panel de admin: empresas, usuarios, reservas, pagos y reembolsos. |
| `server/src/routes/index.js` | Une todas las rutas bajo `/api` (excepto el webhook y la documentación, que se montan en `app.js`). |
 
### Back: `server/src/validators/`
 
Reglas de `express-validator`: un archivo por recurso y un export por endpoint (`bookingValidator.create`). Comprueban formato y rangos; las reglas que necesitan la base de datos (solapes, propiedad) van en los services.
 
| Archivo | Para qué sirve |
| --- | --- |
| `server/src/validators/commonValidator.js` | Reglas reutilizables: id en la URL, fecha `AAAA-MM-DD` y hora entera (8–19) en la query y franja horaria. |
| `server/src/validators/bookingValidator.js` | Validación de reservas: crear (`roomId`, `fecha`, `inicio`, `fin`; fecha no pasada, horas enteras e `inicio < fin`) y cancelar (id en la URL). |
| `server/src/validators/userValidator.js` | Validación del perfil de usuario. |
| `server/src/validators/authValidator.js` | Validación del registro: email, contraseña (mín. 8), nombres, CIF español con dígito de control y teléfono de 9 dígitos. |
| `server/src/validators/companyValidator.js` | Validación del panel de empresa: alta, edificios, plantas, datos de sala y bloqueos. |
| `server/src/validators/mapValidator.js` | Validación de mapas: `validateMap` (función pura: dimensiones, origen, salas dentro del plano, tipos `ROOM_TYPES` e ids únicos), `saveMap` y `publishFloor` para las rutas. |
| `server/src/validators/adminValidator.js` | Validación del panel de admin: aprobar o suspender empresas (`verified`) y cambio de rol. |
| `server/src/validators/buildingValidator.js` | Validación de edificios públicos: id en la URL y fecha opcional del detalle. |
| `server/src/validators/floorValidator.js` | Validación del mapa público de una planta: id en la URL y fecha y hora opcionales; rechaza con 400 las claves `hora[]` y `hora[x]`. |
| `server/src/validators/roomValidator.js` | Validación de salas públicas: id en la URL y fecha opcional para la disponibilidad. |
 
### Back: `server/src/middlewares/`
 
| Archivo | Para qué sirve |
| --- | --- |
| `server/src/middlewares/auth.js` | Verifica el token de Firebase de la cabecera `Authorization` y deja en `req.user` el `uid`, el rol y el `companyId`. |
| `server/src/middlewares/requireRole.js` | Corta la petición con `403` si el rol del usuario no es uno de los permitidos. |
| `server/src/middlewares/requireApprovedCompany.js` | Tras `auth` y `requireRole`: corta con `403 COMPANY_NOT_APPROVED` si la empresa no está aprobada y la deja en `req.company`. |
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
| `server/src/controllers/paymentsController.js` | (extra) Controlador de pagos: checkout de Stripe y webhook. Lee `req`, llama al service y responde; nunca habla con Firestore. |
| `server/src/controllers/usersController.js` | Controlador del perfil de usuario. Lee `req`, llama al service y responde; nunca habla con Firestore. |
| `server/src/controllers/authController.js` | Controlador del registro de clientes y empresas. Lee `req`, llama al service y responde; nunca habla con Firestore. |
| `server/src/controllers/companyController.js` | Controlador del panel de empresa: alta, edificios, plantas, salas, reservas y bloqueos. Lee `req`, llama al service y responde; nunca habla con Firestore. |
| `server/src/controllers/mapsController.js` | Controlador de mapas: guardar, publicar y despublicar. Lee `req`, llama al service y responde; nunca habla con Firestore. |
| `server/src/controllers/adminController.js` | Controlador del panel de admin. Lee `req`, llama al service y responde; nunca habla con Firestore. |
 
### Back: `server/src/services/`
 
| Archivo | Para qué sirve |
| --- | --- |
| `server/src/services/availabilityService.js` | Reglas de disponibilidad: calcula las horas libres de una sala (horario reservable 8–20) a partir de sus reservas `CONFIRMED` y sus `blocks`, el estado de una sala en un día o en una hora (`FREE`, `OCCUPIED` o `UNAVAILABLE`; una sala sin precio no es reservable), `getDayItemsForRooms` (franjas de varias salas con una consulta por lote) y detecta solapes (`nuevoInicio < existenteFin && nuevoFin > existenteInicio`) dentro de una transacción de Firestore. |
| `server/src/services/bookingsService.js` | Crear, listar y cancelar reservas; calcula en el servidor `price`, `pricePeriod` y `totalAmount` a partir del `price` de la sala. |
| `server/src/services/paymentsService.js` | (extra) Crea sesiones de Stripe Checkout, procesa el webhook (firma verificada) y hace reembolsos. |
| `server/src/services/mapDetectionService.js` | Envía la imagen del plano a la IA con visión, le pide solo JSON con las salas detectadas (nombre, código, posición y tamaño) y lo valida antes de devolverlo como borrador del mapa (`ancho`, `alto`, `origen`, `salas`). |
| `server/src/services/futureBookingsService.js` | Cuenta las reservas futuras (`CONFIRMED` o `PENDING_PAYMENT`) de unas salas y redacta el aviso al despublicar o ocultar; no bloquea. |
| `server/src/services/mapsService.js` | Guarda el mapa de una planta (campos `ancho`, `alto`, `origen` y `salas` en `floors`), sincroniza la colección `rooms` en una transacción (crea las salas nuevas, conserva las existentes y marca como no reservables las que ya no están; `409 ROOM_ID_TAKEN` si el id es de otra planta) publica la planta (`MAP_REQUIRED`, `NO_BOOKABLE_ROOMS`) y la despublica (con aviso si el edificio publicado se queda sin plantas publicadas). |
| `server/src/services/companyService.js` | Empresa propia (`getMyCompany`) y, para el panel de empresa, listar y crear/editar edificios, crear/editar plantas (409 `FLOOR_EXISTS` si el número ya existe en el edificio) editar los datos comerciales de una sala, publicar y despublicar edificios (`NO_PUBLISHED_FLOORS`), listar las salas con su estado (`publicada`, `sin_precio`, `oculta`) y mostrarlas u ocultarlas (`ROOM_WITHOUT_PRICE`, `ROOM_INACTIVE`). Body y respuestas en español; whitelist de campos y `companyId` siempre del token. |
| `server/src/services/ownershipService.js` | Propiedad de recursos: `assertOwnedBy` (404 si no existe, 403 si es de otra empresa) y `getOwnedBuilding`, `getOwnedFloor` y `getOwnedRoom`. |
| `server/src/services/usersService.js` | Perfil de usuario y asignación de rol (`CLIENT`, `COMPANY`, `ADMIN`) mediante custom claims (`role`, `companyId`). |
| `server/src/services/authService.js` | Registro: crea el usuario en Firebase Auth, su ficha en `users` (y la empresa pendiente) y su rol; si algo falla, deshace lo creado. Traduce `auth/email-already-exists` a `409 EMAIL_EXISTS`. `setAuthClientForTests` sustituye Firebase Auth en tests. |
| `server/src/services/adminService.js` | Aprobación y suspensión de empresas y listados globales. |
| `server/src/services/buildingsService.js` | Edificios públicos: listado de publicados y detalle con sus plantas y las salas libres de cada una en una fecha. Nunca devuelve quién reservó. |
| `server/src/services/floorsService.js` | Mapa público de una planta publicada: sus salas con estado (`FREE`, `OCCUPIED`, `UNAVAILABLE`), capacidad y precio (solo de las salas reservables; si no, `null`) en una fecha o, con `hora`, a esa hora. Lee reservas y bloqueos por lotes. |
| `server/src/services/roomsService.js` | Ficha pública de una sala y sus horas libres de un día (8–20); `404` si la sala, su planta o su edificio no están publicados. |
 
### Back: `server/src/models/`
 
Un archivo por colección de Firestore. Es la única capa que importa la base de datos (`db()` de `config/config.js`). Los campos de cada colección están en el [Diseño de datos del README](./README.md#diseño-de-datos).
 
| Archivo | Para qué sirve |
| --- | --- |
| `server/src/models/baseModel.js` | Funciones comunes de los models (`findById`, `create`, `upsert`, `update`, `remove`, `listBy`): añaden `createdAt` y `updatedAt` con `serverTimestamp()` y aceptan `{ tx }` para transacciones. |
| `server/src/models/userModel.js` | Acceso a la colección `users` (id = UID de Firebase Auth). Campos: name, surname, email, phone, role (`CLIENT` \| `COMPANY` \| `ADMIN`), createdAt, updatedAt. |
| `server/src/models/companyModel.js` | Acceso a la colección `companies` y a su subcolección `members` (userId, role `OWNER` \| `MANAGER` \| `EMPLOYEE`, joinedAt). Campos: name, legalName, taxId (CIF normalizado), contactName, description, logoUrl, email, phone, address, ownerUid, status (`PENDING` \| `APPROVED` \| `REJECTED`; `SUSPENDED` previsto), verified (status === `APPROVED`), createdAt, updatedAt. `findByTaxId` busca por CIF. |
| `server/src/models/buildingModel.js` | Acceso a la colección `buildings`. Campos: companyId, name, description, address, city, postalCode, country, latitude, longitude, floorCount, photos, status (`DRAFT` \| `PUBLISHED`), createdAt, updatedAt. |
| `server/src/models/floorModel.js` | Acceso a la colección `floors`. Campos: companyId, buildingId, name, level, mapImageUrl, status, createdAt, updatedAt y el mapa en el formato del editor: ancho, alto, origen y `salas` (id, codigo, nombre, tipo, x, y, w, h; el id es el de su documento en `rooms`). |
| `server/src/models/roomModel.js` | Acceso a la colección `rooms` (las salas; id = id de la sala en `floors.salas`). Campos: companyId, buildingId, floorId, name, code, type, description, surface, capacity, price, pricePeriod (`HOUR`), amenities, photos, bookable, status (`ACTIVE` \| `INACTIVE`), openingHours, createdAt, updatedAt. |
| `server/src/models/blockModel.js` | Acceso a la colección `blocks`: horas bloqueadas por la empresa en una sala. Campos: companyId, roomId, startDate, endDate, reason, createdAt, updatedAt. `listByRooms` lee los de varias salas en lotes de 30 (`in`). |
| `server/src/models/occupancyModel.js` | Acceso a la colección `occupancy`: una ficha por sala y hora ocupada con id fijo `roomId_AAAA-MM-DD_HH`, para que dos reservas no puedan coger la misma hora. Campos: companyId, roomId, date, hour, bookingId o blockId, createdAt, updatedAt. |
| `server/src/models/bookingModel.js` | Acceso a la colección `bookings`. Campos: userId, companyId, roomId, startDate, endDate, price, pricePeriod, totalAmount, status (`PENDING_PAYMENT` \| `CONFIRMED` \| `CANCELLED` \| `EXPIRED` \| `COMPLETED`), paymentId, cancelledAt, createdAt, updatedAt. La reserva nace `CONFIRMED`; `PENDING_PAYMENT` y `EXPIRED` solo con el extra de Stripe. `listByRooms` lee las de varias salas en lotes de 30 (`in`). |
| `server/src/models/paymentModel.js` | Acceso a la colección `payments`. Campos: bookingId, userId, amount, currency (`EUR`), provider (`STRIPE`), providerPaymentId, status (`PENDING` \| `SUCCEEDED` \| `FAILED` \| `REFUNDED`), createdAt, updatedAt. |
| `server/src/models/favoriteModel.js` | Acceso a la colección `favorites`: salas guardadas por cada usuario. Estructura por definir; relaciona un usuario con una sala. |
 
### Back: `server/src/utils/`, `app.js` y `server.js`
 
| Archivo | Para qué sirve |
| --- | --- |
| `server/src/utils/httpError.js` | Clase `HttpError(status, code, message)` para lanzar errores con código HTTP desde cualquier capa. |
| `server/src/utils/cif.js` | `normalizeCif` (mayúsculas, sin espacios ni guiones) e `isValidCif` (formato y dígito de control del CIF). |
| `server/src/utils/asyncHandler.js` | Envuelve controladores `async` para que sus errores lleguen al `errorHandler`. |
| `server/src/utils/dates.js` | Utilidades de fechas: validar `AAAA-MM-DD` (fecha real del calendario), `todayString` y `dayRange` (rango de un día en hora local). |
| `server/src/app.js` | Configura Express sin arrancarlo: CORS, límite de peticiones, webhook de Stripe (body sin parsear), JSON, `/api/health`, documentación Swagger en `/api/docs`, rutas y manejo de errores. Lo usan `server.js`, la Netlify Function y los tests. |
| `server/src/server.js` | Arranca la API en local con `app.listen`. En producción no se usa: Netlify ejecuta `app.js` como función. |
 
### Tests: `server/tests/`
 
| Archivo | Para qué sirve |
| --- | --- |
| `server/tests/integration/health.test.js` | Test de integración: la API arranca y `GET /api/health` responde `{ ok: true }`. |
| `server/tests/integration/auth.test.js` | Test de integración: `auth` y `requireRole` con `verifyIdToken` sustituido por un doble (`401 NO_TOKEN`, `401 INVALID_TOKEN`, `403 FORBIDDEN`) y `GET /api/users/me`. |
| `server/tests/integration/docs.test.js` | Test de integración: la especificación OpenAPI se genera y documenta todas las rutas. |
| `server/tests/integration/buildings.test.js` | Test de integración de `GET /api/buildings` y `/buildings/:id` con Firestore sustituido por un doble: solo publicados, salas libres por planta, 404 y 400. |
| `server/tests/integration/floors.test.js` | Test de integración de `GET /api/floors/:id`: estado de cada sala (`FREE`, `OCCUPIED`, `UNAVAILABLE`) en una fecha y a una hora (bordes, bloqueos, sala sin precio), precio y capacidad `null` en salas no reservables, 404 y 400 (incluye `hora[]=10`). |
| `server/tests/integration/rooms.test.js` | Test de integración de `GET /api/rooms/:id` y `/rooms/:id/availability`: ficha, horas libres de 8 a 20, 404 y 400; ninguna respuesta incluye datos de clientes. |
| `server/tests/integration/bookings.test.js` | Test de integración de las reservas del cliente con auth y Firestore sustituidos por dobles: crear (201, 409 `SLOT_TAKEN`, 400, 404, 401), importe y estado no manipulables, occupancy sin datos personales, `GET /bookings/me` y cancelar (200, 403, 400, 404). |
| `server/tests/integration/publishing.test.js` | Test de integración de publicar edificios y gestionar salas de empresa: publicar/despublicar edificio y planta (`NO_PUBLISHED_FLOORS`, aviso, idempotencia), efecto en la API pública, `GET /company/buildings` con plantas, `GET /company/rooms` con estado y filtros, visibilidad de sala (`ROOM_WITHOUT_PRICE`, `ROOM_INACTIVE`) y permisos. |
| `server/tests/helpers/publicData.js` | Datos de prueba de los endpoints públicos (edificios, plantas, salas, reservas y un bloqueo) y utilidades para levantar la app y hacer peticiones. |
| `server/tests/unit/availability.test.js` | Tests unitarios de las reglas de disponibilidad: solapes, bordes de franja, horas libres, `roomStatusAtHour`, `isBookable` y `assertSlotAvailable` con models dobles. |
| `server/tests/unit/mapValidator.test.js` | Tests unitarios de `validateMap`: mapa válido (y `floor-0.json`), salas fuera del plano, coordenadas y tamaños inválidos, tipo, id repetido o con barra, campos que faltan, origen, tipos de dato y más de 300 salas, con el `field` de cada error. |
| `server/tests/unit/ownershipService.test.js` | Tests unitarios de `ownershipService`: 404 si el recurso no existe, 403 si es de otra empresa y devolución del recurso propio (edificio, planta, sala). |
| `server/tests/integration/company.test.js` | Test de integración de `/api/company/*` (edificios, plantas y salas): permisos (401, 403 `FORBIDDEN`, 403 `COMPANY_NOT_APPROVED`), recurso ajeno sin cambios, 404, 409 `FLOOR_EXISTS`, 400 de validación y campos protegidos ignorados. |
| `server/tests/integration/maps.test.js` | Test de integración de `PUT /api/company/floors/:id/map` y `POST .../publish`: permisos, guardar y volver a guardar sincronizando `rooms` (crea, conserva, desactiva sin borrar), 409 `ROOM_ID_TAKEN`, 400 de validación, planta ajena o inexistente, `MAP_REQUIRED`, `NO_BOOKABLE_ROOMS`, publicar idempotente y aviso en planta publicada. |
| `server/tests/integration/register.test.js` | Test de integración del registro (`POST /api/auth/register/client` y `/company`) y `GET /api/companies/me`, con Firebase Auth, token y Firestore sustituidos por dobles: claims y estado fijados por el servidor, `409 EMAIL_EXISTS` y `COMPANY_EXISTS`, rollback si falla Firestore, `400` y permisos. |
| `server/tests/unit/cif.test.js` | Tests unitarios de `utils/cif.js`: normalizar y validar el dígito de control del CIF. |
| `server/tests/unit/requireApprovedCompany.test.js` | Tests unitarios del middleware `requireApprovedCompany`: pasa solo con empresa aprobada (`403 COMPANY_NOT_APPROVED`, `401` sin usuario). |
 
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
| `.claude/agents/front.md` | Agente frontend: trabaja solo en `client/` con componentes en carpeta, CSS Modules y accesibilidad. |
| `.claude/agents/seguridad.md` | Agente de seguridad: audita roles, reglas, pagos, IA y secretos; solo propone. |
| `.claude/agents/qa.md` | Agente de calidad: escribe y ejecuta tests y comprueba los criterios de aceptación. |
| `.claude/agents/revisor.md` | Agente revisor: revisa el diff antes de cada commit; solo comenta. |
 
## Convenciones y flujo de trabajo
 
| Qué | Convención | Ejemplo |
| --- | --- | --- |
| Componentes React | Carpeta `PascalCase/` con `PascalCase.jsx` y `PascalCase.module.css` | `RoomCard/RoomCard.jsx` |
| Hooks | `useCamelCase.js` | `useMapEditor.js` |
| Resto de archivos JS | `camelCase.js` | `bookingsService.js` |
| Rutas, validators y controladores | `recurso.routes.js`, `recursoValidator.js`, `recursoController.js` | `bookings.routes.js` |
| Carpetas | minúsculas, `kebab-case` (salvo las de componente, en `PascalCase`) | `map-editor/` |
| Variables de entorno | `MAYUSCULAS_CON_GUIONES` | `STRIPE_SECRET_KEY` |
| CSS | CSS Modules: un `.module.css` por componente, clases en camelCase; `client/styles/style.css` solo para variables, reset y base; `id` para JavaScript; `@media` y `@keyframes` al final | `styles.roomCard` |
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

## Comandos
- npm run dev       arrancar en local
- npm run build     comprobar que compila
- npm run lint      ESLint

## Convenciones
- Arquitectura basada en componentes (component-based architecture): cada componente y cada página vive en su propia carpeta, con el mismo nombre que el componente, que contiene su `.jsx` y su `.module.css` (`components/room/RoomCard/RoomCard.jsx` + `RoomCard.module.css`).
- Componentes de React en PascalCase y con extensión `.jsx` (`RoomCard.jsx`), un componente por archivo. Las páginas van en `src/pages/` y las piezas reutilizables en `src/components/`.
- Hooks en camelCase empezando por `use` (`useAuth.js`), el resto de archivos JS en camelCase (`bookingsService.js`) y las carpetas de agrupación en kebab-case (`map-editor/`). Las carpetas de componente llevan el nombre del componente en PascalCase (`RoomCard/`).
- Ningún componente llama directamente a Firebase ni a `fetch`: siempre a través de `src/services/`. Las peticiones a la API pasan por `apiClient.js`, que añade el token, y Firebase solo se inicializa en `src/config/firebase.js`.
- CSS propio sin frameworks (nada de Tailwind ni Bootstrap) con CSS Modules: cada componente importa solo su hoja (`import styles from './RoomCard.module.css'`) y usa `className={styles.card}`. Clases en camelCase.
- `client/styles/style.css` queda solo para lo global: variables en `:root`, reset y estilos base. No lleva estilos de componentes.
- En el CSS: colores, espacios y tipografía siempre con las variables de `:root` (`var(--color-primary)`); mobile first; clases para dar estilo y los `id` reservados para JavaScript; `@media` y `@keyframes` siempre al final de cada archivo.
- Textos de la interfaz y mensajes de error en español.
- Body y respuestas de la API en español (`nombre`, `precioHora`, `fecha`, `inicio`, `fin`, `estado`) y Firestore en inglés (`name`, `price`, `startDate`…); equivalencias en el [README](./README.md#9-idioma-de-la-api).

## Flujo de trabajo (GitHub)
- Tablero: proyecto 6 de la org TheBridge-FullStackDeveloper.
- Repo: TheBridge-FullStackDeveloper/AprenTIC_FullStack_Web_Sevilla_P2_Grupo2
- Issue: "ID · descripción". Rama: "ID-slug-en-minusculas". Commit: "ID: qué hace".
- PR: título "[ID] descripción" y en el cuerpo "Closes #N".
- Para trabajar una issue del tablero, sigue la skill flujo-issue.
- Nunca se fusiona una PR: la revisa y la fusiona una persona.

## Prohibido
- Leer o modificar .env o .env.local.
- Escribir claves de [Supabase | Firebase] en el código: siempre import.meta.env.
- Instalar dependencias sin decirlo antes.
- Fusionar PRs, hacer push a main o git push --force.