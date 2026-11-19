# Plan de épicas e issues del front

Plan para construir todos los componentes y páginas del front (`client/src/`) a partir de los wireframes de `docs/images/wireframes/`. El equipo de front somos dos personas.

- **Común (`UI`):** la coge cualquiera de los dos.
- **Cliente (`CLI`):** persona A.
- **Empresa (`EMP`):** persona B.
- **Admin (`ADM`):** persona A, después de cliente.

Tamaños orientativos: **S** ≈ medio día · **M** ≈ 1–2 días · **L** ≈ 3 días o más.

Todas las páginas se maquetan con **datos de prueba** (UI015) servidos por `src/services/` y se conectarán a la API en una épica futura (`INT`). Los endpoints públicos de edificios, plantas y salas ya existen (DAT011, #97), así que esos services pueden conectarse antes si el equipo lo decide.

Estado en el tablero: la épica `UI` (#72) y sus 18 issues, la épica `CLI` (#101) y sus 16 issues, y la épica `EMP` (#124) y sus 16 issues están creadas. La épica `ADM` está pendiente de crear.

## Épica 1 · `UI` Base común (la coge cualquiera de los dos) · #72

Bloquea al resto, así que va primero. Se reparte por orden de llegada: cada uno se asigna la siguiente libre. UI001, UI012 y UI015 son las primeras porque desbloquean todas las páginas.

SET010 (#64, «Componentes comunes react») se cerró por duplicada: su contenido está repartido en UI002, UI003 y UI004. Su «botón flecha» se descarta porque no aparece en los wireframes; en su lugar, UI002 incluye `IconButton` y `BackLink`.

| Issue                                                      | Contenido                                                                                                                                                                      | Tam. | Depende de                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---------------------------------------- |
| #75 · UI001 · Tokens de interfaz para los componentes      | Espaciado, colores de interfaz, campos, elevación, capas y transiciones en `style.css` y `fundamentos.md`                                                                      | S    | Decidir color de paneles y texto pequeño |
| #76 · UI002 · Botones, enlace Volver y spinner             | `Button` (variantes, `loading`, `disabled`), `IconButton` (solo icono, con `aria-label`), `BackLink` («← Volver a…») y `Spinner`                                               | M    | UI001                                    |
| #77 · UI003 · Campos de formulario                         | `Input`, `Select`, `Textarea`, `Checkbox`                                                                                                                                      | M    | UI001                                    |
| #78 · UI004 · Etiquetas: chip, avatar y estado             | `Chip`, `Avatar`, `StatusBadge` con todos los estados de los wireframes (sala, edificio y planta, reserva, pago, empresa y cuenta de cobro), definidos en `constants.js`       | S    | UI001                                    |
| #79 · UI005 · Bloques de estado                            | `Alert`, `EmptyState`, `StatCard`, `ErrorState`                                                                                                                                | M    | UI002                                    |
| #80 · UI006 · Modal y modal de confirmación                | `Modal` (Escape, foco atrapado) y `ConfirmModal` con contenido libre (campos, tablas, casillas, botones de opción, avisos), acción que se puede desactivar y acción secundaria | M    | UI002, UI003                             |
| #81 · UI007 · Tabla y filtros de los paneles               | `DataTable` (acciones, vacío, tarjetas en móvil) y `FilterBar`                                                                                                                 | L    | UI003, UI005                             |
| #82 · UI008 · Subida de archivos                           | `FileDropzone`                                                                                                                                                                 | S    | UI002                                    |
| #83 · UI009 · Cabecera con menú de usuario y menú móvil    | `Header`, `UserMenu`, `MobileMenu` según el rol                                                                                                                                | M    | UI004                                    |
| #84 · UI010 · Plantilla pública y banner de cookies        | `Layout` (todas las páginas públicas salvo las de acceso, que usan `AuthLayout`), `Footer` completo y reducido, `CookieBanner` con configuración                               | S    | UI009                                    |
| #85 · UI011 · Plantilla de los paneles                     | `DashboardLayout` con menú de empresa y de admin                                                                                                                               | M    | UI009                                    |
| #73 · UI012 · Rutas de las páginas nuevas                  | Las 7 páginas nuevas con su ruta, las 2 rutas de detalle de reserva de empresa y admin, alta de empresa fuera del panel y «Ajustes» en el menú de empresa (ver abajo)          | S    | —                                        |
| #86 · UI013 · Plano de planta                              | `FloorPlan`, `RoomShape`, `Legend` a partir de `demo-floor.json`; zonas comunes rayadas y no seleccionables; ampliar con dos dedos en móvil                                    | L    | UI001                                    |
| #87 · UI014 · Detalle de reserva común                     | `BookingDetail` con datos y acciones según el rol; se usa como página (cliente) o dentro de un panel lateral (empresa y admin)                                                 | M    | UI004, UI006                             |
| #74 · UI015 · Datos de prueba servidos por los services    | Datos de prueba servidos por los services (ver abajo)                                                                                                                          | M    | —                                        |
| #90 · UI016 · Migas, pestañas y hoja inferior              | `Breadcrumbs` (edificio, planta y sala), `Tabs` (ajustes de empresa) y `BottomSheet` (hoja que sube desde abajo en móvil: panel de sala, filtros de búsqueda)                  | M    | UI001                                    |
| #91 · UI017 · Opciones y pasos                             | `Radio` (reembolso total o parcial, lugar principal), `SegmentedControl` (tipo de sala en el editor) y `Stepper` (los 4 pasos del alta de empresa)                             | S    | UI003                                    |
| #92 · UI018 · Panel lateral, barra fija y menú de acciones | `SidePanel` (detalle de reserva de empresa y admin), `StickyActionBar` (barra fija inferior en móvil con total y botón) y `ActionMenu` (menú «···» de la tarjeta de edificio)  | M    | UI002                                    |

### UI012 · Rutas de las páginas nuevas

Las rutas de las páginas que ya existían las hizo SET002 (#17). Falta:

- Crear el esqueleto de las 7 páginas nuevas y su ruta: `Search` (`/search`), `ForgotPassword` (`/forgot-password`), `ResetPassword` (`/reset-password`), `BookingDetailPage` (`/my-bookings/:bookingId`), `CompanyRequestStatus` (`/company/request`), `CompanySettings` (`/company/settings`) y `AdminCompanyDetail` (`/admin/companies/:companyId`).
- Añadir `/company/bookings/:bookingId` y `/admin/bookings/:bookingId`, que muestran `CompanyBookings` y `AdminBookings`. Según los wireframes `15b` y `19b`, el detalle es un panel lateral sobre la lista, que se hace en EMP014 y ADM005. Por eso `CompanyBookingDetail` y `AdminBookingDetail` ya no se crean.
- Sacar `company/register` y `company/request` del `DashboardLayout`: quien pide el alta todavía no tiene panel (el alta se rellena sin sesión y crea una cuenta de empresa nueva, distinta de la de cliente; ver EMP001).
- Añadir «Ajustes» al menú lateral de empresa.

Las guardas de ruta no entran aquí: necesitan el `AuthProvider` conectado a Firebase Auth y van en **DAT009 · AuthProvider y guardas de ruta en el front (#88)**, dentro de la épica DAT (#3). DAT009 depende de UI012.

### UI001 · Tokens de interfaz para los componentes

La paleta, la tipografía, los radios y el reset ya están hechos (DIS001 en `docs/diseno/fundamentos.md` y SET006 en `client/styles/style.css`). Faltan los tokens que necesitan los componentes:

| Falta                                                                        | Por qué lo necesitan los componentes                                                                  |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Escala de espaciado (`--espacio-1` … `--espacio-8`)                          | Hoy solo existen los alias provisionales `--space-sm` y `--space-md`                                  |
| Colores de interfaz: error, aviso, éxito, info                               | `Alert`, errores de `Input` y `StatusBadge`. `--ocupada` es un estado de sala, no un error            |
| Campos de formulario: fondo, borde, borde con foco, placeholder, desactivado | `Input`, `Select`, `Textarea`, `Checkbox`                                                             |
| Elevación: sombras y fondo oscuro detrás del modal                           | `Modal`, `UserMenu`, `CookieBanner`                                                                   |
| Capas (`--z-cabecera`, `--z-menu`, `--z-modal`, `--z-aviso`)                 | Que el modal, el menú móvil y el banner no se tapen entre sí                                          |
| Duración de transiciones                                                     | Menús, modales, hover                                                                                 |
| Texto pequeño (14 px)                                                        | Chips, cabeceras de tabla y etiquetas (decisión de diseño: `fundamentos.md` lo descartó)              |
| Breakpoints                                                                  | Se documentan como convención (p. ej. 640 / 1024 px): una variable CSS no funciona dentro de `@media` |

**Entrega:** una sola PR.

1. Añadir a `fundamentos.md` los tokens nuevos con su comprobación de contraste WCAG (como en la sección 2.3) y actualizar la sección 4.
2. Añadir los tokens a `:root` en `style.css` y sustituir los alias provisionales por la escala nueva, actualizando `DashboardLayout` y `Footer`.

**Hecha cuando:**

- Todos los tokens de la tabla están en `style.css` y documentados en `fundamentos.md`.
- Los colores nuevos cumplen AA sobre el fondo en el que se usan.
- No quedan alias provisionales ni ningún componente roto.
- `npm run lint` y `npm run build` pasan sin errores.

### UI015 · Datos de prueba

Sigue la regla de `AGENTS.md`: ningún componente obtiene datos directamente, siempre a través de `src/services/`.

- **Datos:** carpeta `client/src/mocks/` con JSON de edificios, plantas (a partir de `demo-floor.json`), salas, reservas, empresas, usuarios y pagos.
- **Services:** cada service de `src/services/` devuelve esos datos con un pequeño retardo simulado, para poder ver los estados de carga.
- **Interruptor:** una variable `VITE_USE_MOCKS` en `.env.example` activa los datos de prueba. Cuando exista la API, se cambia el interior de cada service y las páginas no se tocan.
- **Formato de los datos:** sigue los campos del [Diseño de datos del README](../README.md#diseño-de-datos), para que luego la API encaje, más los que piden los wireframes y aún no están en el README: código de reserva, asistentes, tipo de sala y motivo de cancelación (hay que avisar a back).
- **Estados:** hay reservas en todos los estados que usan las pantallas y empresas en todos los suyos.

## Épica 2 · `CLI` Cliente (persona A) · #101

| Issue                                      | Contenido                                                                                                                                                                                                                                                                                                                                                                   | Tam. | Depende de          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------- |
| #102 · CLI001 · Login y registro           | `AuthLayout` (plantilla sin cabecera ni pie, con la imagen del edificio a la izquierda) y sus rutas fuera de `Layout`; `Login` revisado (un solo login para cliente, empresa y admin, que redirige según el rol, y enlace «Publica tu oficina»); `Register` con aceptación de la política de privacidad y errores bajo cada campo; Google                                   | M    | UI003               |
| #103 · CLI002 · Recuperar contraseña       | `ForgotPassword` (mismo mensaje exista o no la cuenta) y `ResetPassword` con el estado «Enlace caducado»                                                                                                                                                                                                                                                                    | S    | CLI001              |
| #104 · CLI003 · Landing                    | Hero con el edificio por plantas (hover en escritorio; en móvil, 1.er toque resalta y 2.º abre la planta), `SearchBar`, salas destacadas con `CategoryFilters` y `RoomCard`, cómo funciona y llamada a empresas                                                                                                                                                             | L    | UI010, UI015        |
| #105 · CLI004 · Resultados de búsqueda     | `Search`, `CategoryFilters`, filtros de precio y orden, `BuildingCard` con chips de sus salas libres, «Ver más edificios» y sin resultados. En móvil: resumen de la búsqueda con «Editar» y filtros en hoja inferior                                                                                                                                                        | M    | CLI003, UI016       |
| #106 · CLI005 · Página de edificio         | `Building` con migas de pan, `BuildingHero` y `FloorSelector` enlazados (hover en uno resalta el otro); plantas no reservables marcadas                                                                                                                                                                                                                                     | M    | UI010, UI015, UI016 |
| #107 · CLI006 · Página de planta           | `Floor` con migas de pan, selector de planta (pestañas; desplegable en móvil), selector de fecha y `RoomSidePanel` con huecos libres de hoy (hoja inferior en móvil). Zonas comunes rayadas y no clicables                                                                                                                                                                  | M    | UI013, UI016        |
| #108 · CLI007 · Ficha de sala              | `Room` con migas de pan, `RoomGallery` (deslizable en móvil), cifras, descripción, `AmenitiesList` y «Cómo llegar» con mapa pequeño                                                                                                                                                                                                                                         | L    | UI004, UI015, UI016 |
| #109 · CLI008 · Elegir hora                | `BookingForm` dentro de la ficha de sala: fecha, horas seguidas (las ocupadas en gris), asistentes y total; «Necesitas iniciar sesión para reservar»; en móvil, barra fija con total y «Reservar»                                                                                                                                                                           | M    | CLI007, UI018       |
| #110 · CLI009 · Revisa tu reserva          | (extra, sin pago en el MVP) Página nueva `BookingCheckout` (`/checkout/:bookingId`, la reserva ya existe como `PENDING_PAYMENT`): `BookingSummary`, política de cancelación, aviso de los 15 minutos e «Ir a pagar» (simulado hasta tener Stripe); barra fija en móvil; estado «Tiempo agotado» con «Reservar de nuevo» (solo si la franja sigue libre) y «Ver otras horas» | M    | CLI008, UI018       |
| #111 · CLI010 · Resultado del pago         | (extra, sin pago en el MVP) `PaymentResult`: reserva confirmada y pago no completado («Intentar de nuevo», «Cambiar la reserva»), escritorio y móvil                                                                                                                                                                                                                        | S    | CLI009              |
| #112 · CLI011 · Mis reservas               | `MyBookings`, `BookingCard`, próximas y pasadas, «Pagar ahora» en las pendientes de pago (extra, sin pago en el MVP), cancelar con `ConfirmModal` (con o sin reembolso según falten más o menos de 24 h) y estado vacío                                                                                                                                                     | M    | UI005, UI006, UI015 |
| #113 · CLI012 · Detalle y cancelación      | `BookingDetailPage` sobre `BookingDetail`: código de reserva, «Cómo llegar», «Descargar factura», cancelar (solo reservas futuras) y variantes de estado (pendiente de pago, finalizada, cancelada por ti, cancelada por el espacio con su motivo, reembolso en curso)                                                                                                      | M    | UI014               |
| #114 · CLI013 · Mi cuenta                  | Página de cuenta enlazada desde `UserMenu` y `MobileMenu`: «Mis datos» (nombre, email, teléfono, con el formulario del registro) y «Cambiar contraseña»                                                                                                                                                                                                                     | S    | UI003               |
| #115 · CLI014 · Páginas de error           | `NotFound` y error del servidor o sin conexión                                                                                                                                                                                                                                                                                                                              | S    | UI005               |
| #120 · CLI015 · _Extra_ Qué hay cerca      | `NearbyMap`: mapa y lista enlazados, tiempos a pie y en coche, punto principal destacado                                                                                                                                                                                                                                                                                    | M    | CLI005              |
| #121 · CLI016 · _Extra_ Mapa de resultados | `SearchMap`; en móvil, «Ver mapa» cambia la lista por el mapa a pantalla completa                                                                                                                                                                                                                                                                                           | M    | CLI004              |

**Preparado para el back:** las pantallas de cliente solo hablan con los services (`authService`, `buildingsService`, `floorsService`, `roomsService`, `bookingsService`, `paymentsService`). En CLI001, `authService` simula Firebase Auth y lanza los mismos códigos de error que dará Firebase, para que el login y el registro no cambien al conectarlo en `INT`. En CLI009, `paymentsService` simula Stripe Checkout: cuando exista, devolverá la URL de Stripe y la página solo redirigirá.

**Concreciones al crear las issues:**

- `BuildingHero` lo usan CLI003 y CLI005: lo crea la primera de las dos que se haga y la otra lo reutiliza.
- UI012 no incluye las rutas de CLI009 (`/checkout/:bookingId`) ni de CLI013 (p. ej. `/account`): las añade cada issue, y las dos piden sesión.

**Resuelto con back (DAT017):** la reserva nace `CONFIRMED`; `PENDING_PAYMENT`, la caducidad a los 15 minutos y Stripe (wireframes `07`, `07b`, `07c` y `08`) son el extra 2. Campos de la reserva en la API: `roomId`, `fecha`, `inicio`, `fin` (equivalencias con Firestore en el [README](../README.md#9-idioma-de-la-api)).

## Épica 3 · `EMP` Empresa (persona B) · #124

| Issue                                              | Contenido                                                                                                                                                                                                                                                                                                                                                   | Tam. | Depende de                 |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------- |
| #125 · EMP001 · Alta de empresa                    | `CompanyRegister` sin sesión: crea una cuenta de empresa nueva (email de acceso, contraseña, datos de la empresa, ciudad y condiciones) con el `Stepper` de 4 pasos. `CompanyRequestStatus` con cabecera de empresa sin navegación: en revisión («Editar datos de la solicitud») o rechazada con su motivo («Corregir y reenviar», «Contactar con iPuente») | M    | UI003, UI017               |
| #126 · EMP002 · Resumen                            | `CompanyDashboard` con `StatCard`, próximas reservas y tareas pendientes con «Resolver» (planta sin publicar, salas sin precio, salas sin fotos). Primer acceso: bienvenida con los pasos (primer edificio, primer plano), cifras ocultas y reservas vacías                                                                                                 | M    | UI005, UI007, UI011, UI015 |
| #127 · EMP003 · Mis edificios                      | `CompanyBuildings`: tarjeta de edificio con estado y `FloorList` (estado de cada planta, «Editar mapa», «+ Añadir planta»); `BuildingMenu` (editar, ver ficha pública, despublicar con confirmación, eliminar bloqueado si hay reservas futuras); modal «Añadir planta» (nombre, posición, tiene salas) que abre el editor sin plano; estado vacío          | M    | UI006, UI011, UI018        |
| #128 · EMP004 · Formulario de edificio             | Página `BuildingForm` en lugar de `BuildingFormModal` (`/company/buildings/new` y `/company/buildings/:buildingId/edit`): datos, plantas (ordenar, «Tiene salas», eliminar, añadir), imagen de la fachada, «Guardar borrador» y «Guardar edificio»                                                                                                          | L    | EMP003                     |
| #129 · EMP005 · Zonas de la fachada                | «Dibujar zona»: marcar cada planta con un rectángulo sobre la foto de la fachada; es lo que usa `BuildingHero` en la landing y en el edificio                                                                                                                                                                                                               | M    | EMP004                     |
| #130 · EMP006 · _Extra_ Qué hay cerca del edificio | Tabla editable de lugares cercanos en `BuildingForm` (lugar, tipo, a pie, en coche, principal) con «Añadir lugar»; alimenta `NearbyMap`                                                                                                                                                                                                                     | S    | EMP004, UI017              |
| #131 · EMP007 · Editor I: lienzo                   | `MapEditor`, `RoomHandle`, `EditorToolbar`, `useMapEditor` (dibujar, mover, redimensionar, deshacer). Pantalla completa, con su ruta fuera de `DashboardLayout` y cabecera propia (volver, edificio · planta, estado, «Guardar borrador», «Publicar planta»)                                                                                                | L    | UI002                      |
| #132 · EMP008 · Editor II: plano e IA              | `PlanUploader` (estado sin plano y «Empieza en blanco»), `EditorStartChoice`, `DetectionOverlay` y `DetectionError` («Dibujar a mano», «Subir otro plano», «Reintentar»; aviso si detecta pocas salas). La detección se simula con un borrador de prueba                                                                                                    | M    | EMP007, UI008              |
| #133 · EMP009 · Editor III: panel de sala          | `RoomPropertiesPanel` único, que también usa Salas (sustituye a `RoomEditPanel`): código, nombre, tipo (Sala, Box, Zona común), precio, personas, m², equipamiento, fotos y «Reservable»; lista de salas si no hay ninguna seleccionada; eliminar sala (avisa de las reservas futuras, que se cancelan y reembolsan); `UnsavedChangesModal`                 | L    | EMP007, UI017              |
| #134 · EMP010 · Editor IV: guardar y publicar      | `PublishValidationModal` (los errores bloquean y los avisos no; «Revisar» selecciona la sala afectada; comprueba la cuenta de cobro), guardar borrador, publicar y aviso «Planta publicada»                                                                                                                                                                 | M    | EMP009                     |
| #135 · EMP011 · Salas                              | `CompanyRooms` con filtros de edificio, planta y estado; estados publicada, sin precio y oculta; ocultar y mostrar (una sala sin precio no se puede mostrar); «Editar» abre `RoomPropertiesPanel`                                                                                                                                                           | M    | UI007, EMP009              |
| #136 · EMP012 · Fotos de sala                      | `RoomPhotosManager` (subir, ordenar, portada) dentro de `RoomPropertiesPanel`                                                                                                                                                                                                                                                                               | M    | UI008, EMP009              |
| #137 · EMP013 · Reservas y bloqueos                | `CompanyBookings` con filtros de edificio, sala y fecha; bloqueos en la misma tabla con estado «Bloqueada»; `BlockHoursModal` (sala, fecha, desde, hasta, repetir, motivo y aviso si choca con una reserva)                                                                                                                                                 | M    | UI006, UI007               |
| #138 · EMP014 · Detalle de reserva                 | Panel lateral sobre `CompanyBookings` (la ruta `/company/bookings/:bookingId` abre la lista con el panel abierto): `BookingDetail` con desglose de comisiones, cancelar (motivo obligatorio y mensaje opcional para el cliente), «Escribir al cliente» y «Quitar bloqueo»                                                                                   | M    | UI014, UI018, EMP013       |
| #139 · EMP015 · Ajustes                            | `CompanySettings` con pestañas Empresa (datos del alta), Cobros y Cuenta de acceso (email y contraseña). Cobros (extra, fuera del MVP): los 3 estados de Stripe Connect y la tabla de movimientos, solo maqueta                                                                                                                                             | M    | UI007, UI011, UI016        |
| #140 · EMP016 · _Extra_ Edificio 3D                | `Building3D`                                                                                                                                                                                                                                                                                                                                                | L    | EMP010                     |

**Back necesario para terminarla:** las pantallas de empresa se maquetan con datos de prueba. Lo que tiene que dar la API para cada issue (lo que ya cubren DAT013–DAT018 y lo que falta, repartido en DAT019–DAT038) está en [`docs/back-pendiente-emp.md`](./back-pendiente-emp.md).

## Épica 4 · `ADM` Admin (persona A, después de cliente)

Es la épica más ligera porque casi todo reutiliza piezas comunes (`DataTable`, `FilterBar`, `ConfirmModal`, `BookingDetail`, `StatCard`).

| Issue                       | Contenido                                                                                                                                                                                                                         | Tam. | Depende de          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------- |
| ADM001 · Resumen            | `AdminDashboard` con `StatCard` (empresas, pendientes de aprobar, reservas e ingresos del mes = comisiones cobradas menos devueltas), tabla de empresas pendientes («Ver», «Aprobar») y tabla de actividad reciente               | M    | UI005, UI007, UI011 |
| ADM002 · Empresas           | `AdminCompanies` con filtros de estado y ciudad; acciones según el estado: aprobar o rechazar (pendiente), suspender (activa), reactivar (suspendida)                                                                             | M    | UI006, UI007        |
| ADM003 · Detalle de empresa | `AdminCompanyDetail`: datos, cuenta y cobros, edificios e historial; acciones según el estado. Modal de rechazar (motivo obligatorio) y de suspender (reservas futuras afectadas, motivo obligatorio y casilla de confirmación)   | M    | ADM002              |
| ADM004 · Usuarios           | `AdminUsers` con filtro por rol y buscador por email; `RoleSelect` en un modal con confirmación del cambio de rol                                                                                                                 | M    | UI007               |
| ADM005 · Reservas           | `AdminBookings` con filtros de empresa, estado y fecha; detalle en panel lateral (la ruta `/admin/bookings/:bookingId` abre la lista con el panel abierto): `BookingDetail` con desglose, historial, «Reembolsar» y «Ver empresa» | M    | UI007, UI014, UI018 |
| ADM006 · Pagos              | (extra, sin pago en el MVP) `AdminPayments` con filtros de estado y mes, columnas de comisión de iPuente y transferencia a la empresa; «Reembolsar» solo en pagos no reembolsados; modal de reembolso (total o parcial, motivo)   | M    | UI006, UI007, UI017 |

## Reparto y orden

| Fase       | Persona A                                                                                                      | Persona B                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1 · Base   | Se reparten UI001–UI018 por orden de llegada. Primero UI001, UI012 y UI015. Después de UI012, DAT009 (guardas) |                                                                                       |
| 2          | CLI001 → CLI014                                                                                                | EMP001 → EMP015 sin EMP006 (el editor, EMP007, empieza en cuanto estén UI001 y UI002) |
| 3          | ADM001 → ADM006                                                                                                | Lo que quede de empresa y ayuda en admin si acaba antes                               |
| 4 · Extras | CLI015, CLI016                                                                                                 | EMP006, EMP016                                                                        |

Carga estimada: A ≈ 29 días (cliente + admin) y B ≈ 26 días (empresa). La diferencia compensa el riesgo del editor de mapas; si B acaba antes, coge issues de `ADM`.

**Reglas para no pisarse:**

- Cada componente común tiene un responsable, y hay que fijar sus props antes de usarlo, para poder usarlo sin esperar a que esté terminado.
- La fase 1 se fusiona antes de empezar las páginas que dependen de ella. Mientras tanto se puede maquetar con los datos de prueba.
- `App.jsx`, `constants.js` y `style.css` los tocan los dos: cambios en PRs pequeñas y avisando.

## Épica futura · `INT` Integración con la API

Cuando el back tenga endpoints, una issue por service para cambiar los datos de prueba por llamadas reales con `apiClient`. Hay que hacerlo también con Firebase Auth en el login, Stripe en el pago e IA en el editor. Como las páginas solo hablan con los services, no deberían cambiar.

Endpoints que el front va a necesitar y que hay que acordar con back:

- Búsqueda de edificios por ciudad, fecha y personas, con filtros de tipo de sala y precio, orden y paginación.
- Detalle de reserva (cliente, empresa y admin) y detalle de empresa (admin).
- Ocultar y mostrar sala.
- Stripe Connect para los cobros de las empresas: estado de la cuenta, movimientos y comisiones.
- Alta de empresa sin sesión (crea la cuenta de acceso y la empresa), editar y reenviar la solicitud, y cambiar email y contraseña de la cuenta de empresa.
- Perfil del cliente («Mis datos») y cambio de contraseña.
- Edificios: foto de la fachada con la zona de cada planta, lugares cercanos, despublicar, eliminar (bloqueado con reservas futuras) y orden de las plantas.
- Cancelación por la empresa con motivo y mensaje, y factura de la reserva.
- Bloqueos que se repiten y quitar bloqueo.
- Reservas futuras afectadas, para avisar antes de eliminar una sala o suspender una empresa.
- Tareas pendientes del resumen de empresa.
- Admin: reactivar empresa, actividad reciente, e historial de empresa y de reserva.

Campos que piden los wireframes y que no están en el [Diseño de datos del README](../README.md#diseño-de-datos): código de reserva (`IP-2041`), motivo de cancelación, tipo de sala (sala, box, zona común), zonas de la fachada, lugares cercanos, repetición de bloqueos y asistentes de la reserva.

## Criterios comunes de «Hecha cuando»

Además de los suyos propios, cada issue cumple:

- Funciona en móvil y escritorio.
- Se puede usar con teclado.
- Tiene estados de carga, vacío y error.
- Sigue las convenciones de `AGENTS.md` (carpeta por componente, CSS Modules, variables de `:root`, textos en español).
- `npm run lint` y `npm run build` pasan sin errores.

## Pendiente de decidir

1. **Color de los paneles:** oscuro, como Bosque, o claro, como los wireframes. Bloquea UI001.
2. **Texto pequeño:** si se recupera el de 14 px para chips y tablas. Bloquea UI001.
3. **Pantallas sin wireframe**, fuera del plan hasta que se decida:
   - «Para empresas», «Cómo funciona» y «Contacto» del menú (¿secciones de la landing o páginas?).
   - Páginas legales que enlaza el banner de cookies.
   - Favoritos.
   - A dónde llevan «Contactar con iPuente» (solicitud rechazada) y «Escribir al cliente» (detalle de reserva de empresa).
4. **`AvailabilityCalendar`:** en los wireframes los huecos libres se eligen en `BookingForm` (ficha de sala) y `RoomSidePanel` muestra los de hoy; no aparece un calendario aparte. Si se confirma, se quita de `AGENTS.md`.
5. **Reembolso parcial:** el modal de reembolso de admin lo deja pendiente.
6. ~~**Email de empresa ya registrado como cliente**~~: decidido el 2026-11-19. El alta muestra «Este email ya tiene una cuenta de cliente. Usa otro para tu empresa.» (EMP001, #125; el back que falta está en `docs/back-pendiente-emp.md`).
