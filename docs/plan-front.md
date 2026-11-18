# Plan de épicas e issues del front

Plan para construir todos los componentes y páginas del front (`client/src/`) a partir de los wireframes de `docs/images/wireframes/`. El equipo de front somos dos personas.

- **Común (`UI`):** la coge cualquiera de los dos.
- **Cliente (`CLI`):** persona A.
- **Empresa (`EMP`):** persona B.
- **Admin (`ADM`):** persona A, después de cliente.

Tamaños orientativos: **S** ≈ medio día · **M** ≈ 1–2 días · **L** ≈ 3 días o más.

Todavía no hay endpoints en la API: todas las páginas se maquetan con **datos de prueba** (UI015) y se conectarán a la API en una épica futura (`INT`).

## Épica 1 · `UI` Base común (la coge cualquiera de los dos)

Bloquea al resto, así que va primero. Se reparte por orden de llegada: cada uno se asigna la siguiente libre. UI001, UI012 y UI015 son las primeras porque desbloquean todas las páginas.

| Issue | Contenido | Tam. | Depende de |
| --- | --- | --- | --- |
| UI001 · Tokens de interfaz para los componentes | Espaciado, colores de interfaz, campos, elevación, capas y transiciones en `style.css` y `fundamentos.md` | S | Decidir color de paneles y texto pequeño |
| UI002 · Botón y spinner | `Button` (variantes, `loading`, `disabled`), `Spinner` | S | UI001 |
| UI003 · Campos de formulario | `Input`, `Select`, `Textarea`, `Checkbox` | M | UI001 |
| UI004 · Etiquetas | `Chip`, `Avatar`, `StatusBadge` (todos los estados) | S | UI001 |
| UI005 · Bloques de estado | `Alert`, `EmptyState`, `StatCard`, `ErrorState` | M | UI002 |
| UI006 · Modales | `Modal` (Escape, foco atrapado) y `ConfirmModal` (motivo opcional) | M | UI002, UI003 |
| UI007 · Tablas de panel | `DataTable` (acciones, vacío, tarjetas en móvil) y `FilterBar` | L | UI003, UI005 |
| UI008 · Subida de archivos | `FileDropzone` | S | UI002 |
| UI009 · Cabecera | `Header`, `UserMenu`, `MobileMenu` según el rol | M | UI004 |
| UI010 · Plantilla pública | `Layout`, `Footer`, `CookieBanner` | S | UI009 |
| UI011 · Plantilla de paneles | `DashboardLayout` con menú de empresa y de admin | M | UI009 |
| UI012 · Rutas | Todas las rutas nuevas en `App.jsx`, con `PrivateRoute` y `RoleRoute` | S | — |
| UI013 · Plano de planta | `FloorPlan`, `RoomShape`, `Legend` a partir de `demo-floor.json` | L | UI001 |
| UI014 · Detalle de reserva | `BookingDetail` con acciones según el rol | M | UI004, UI006 |
| UI015 · Datos de prueba | Datos de prueba servidos por los services (ver abajo) | M | — |

### UI001 · Tokens de interfaz para los componentes

La paleta, la tipografía, los radios y el reset ya están hechos (DIS001 en `docs/diseno/fundamentos.md` y SET006 en `client/styles/style.css`). Faltan los tokens que necesitan los componentes:

| Falta | Por qué lo necesitan los componentes |
| --- | --- |
| Escala de espaciado (`--espacio-1` … `--espacio-8`) | Hoy solo existen los alias provisionales `--space-sm` y `--space-md` |
| Colores de interfaz: error, aviso, éxito, info | `Alert`, errores de `Input` y `StatusBadge`. `--ocupada` es un estado de sala, no un error |
| Campos de formulario: fondo, borde, borde con foco, placeholder, desactivado | `Input`, `Select`, `Textarea`, `Checkbox` |
| Elevación: sombras y fondo oscuro detrás del modal | `Modal`, `UserMenu`, `CookieBanner` |
| Capas (`--z-cabecera`, `--z-menu`, `--z-modal`, `--z-aviso`) | Que el modal, el menú móvil y el banner no se tapen entre sí |
| Duración de transiciones | Menús, modales, hover |
| Texto pequeño (14 px) | Chips, cabeceras de tabla y etiquetas (decisión de diseño: `fundamentos.md` lo descartó) |
| Breakpoints | Se documentan como convención (p. ej. 640 / 1024 px): una variable CSS no funciona dentro de `@media` |

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
- **Formato de los datos:** sigue los campos del [Diseño de datos del README](../README.md#diseño-de-datos), para que luego la API encaje.

## Épica 2 · `CLI` Cliente (persona A)

| Issue | Contenido | Tam. | Depende de |
| --- | --- | --- | --- |
| CLI001 · Login y registro | `Login` revisado, `Register`, Google | M | UI003 |
| CLI002 · Recuperar contraseña | `ForgotPassword`, `ResetPassword` | S | UI003 |
| CLI003 · Landing | Hero, `SearchBar`, salas destacadas, cómo funciona, llamada a empresas | L | UI010, UI015 |
| CLI004 · Resultados de búsqueda | `Search`, `CategoryFilters`, `BuildingCard`, sin resultados (escritorio y móvil) | M | CLI003 |
| CLI005 · Página de edificio | `Building`, `BuildingHero`, `FloorSelector` | M | UI010, UI015 |
| CLI006 · Página de planta | `Floor`, selector de fecha, `RoomSidePanel` | M | UI013 |
| CLI007 · Ficha de sala | `Room`, `RoomGallery`, `AmenitiesList`, `AvailabilityCalendar` | L | UI004, UI015 |
| CLI008 · Reservar | `BookingForm`, `BookingSummary`; el pago se simula hasta tener Stripe | M | CLI007 |
| CLI009 · Resultado del pago | `PaymentResult` (confirmada, cancelada, expirada) y versión móvil | S | CLI008 |
| CLI010 · Mis reservas | `MyBookings`, `BookingCard`, próximas y pasadas | M | UI005, UI015 |
| CLI011 · Detalle y cancelación | `BookingDetailPage` con `ConfirmModal` | S | UI014 |
| CLI012 · Páginas de error | `NotFound` y error del servidor o sin conexión | S | UI005 |
| CLI013 · _Extra_ Qué hay cerca | `NearbyMap` | M | CLI005 |
| CLI014 · _Extra_ Mapa de resultados | `SearchMap` | M | CLI004 |

## Épica 3 · `EMP` Empresa (persona B)

| Issue | Contenido | Tam. | Depende de |
| --- | --- | --- | --- |
| EMP001 · Alta de empresa | `CompanyRegister` revisado y `CompanyRequestStatus` (en revisión o rechazada) | M | UI003 |
| EMP002 · Resumen | `CompanyDashboard` con `StatCard` y estado vacío del primer acceso | S | UI011, UI015 |
| EMP003 · Edificios y plantas | `CompanyBuildings`, `FloorList`, `BuildingMenu`, `BuildingFormModal` | L | UI006, UI011 |
| EMP004 · Editor I: lienzo | `MapEditor`, `RoomHandle`, `EditorToolbar`, `useMapEditor` (dibujar, mover, redimensionar, deshacer) | L | UI002 |
| EMP005 · Editor II: plano e IA | `PlanUploader`, `EditorStartChoice`, `DetectionOverlay`, `DetectionError`; la detección se simula con un borrador de prueba | M | EMP004, UI008 |
| EMP006 · Editor III: datos de sala | `RoomPropertiesPanel`, eliminar sala, `UnsavedChangesModal` | M | EMP004 |
| EMP007 · Editor IV: guardar y publicar | `PublishValidationModal`, guardar borrador y publicar | M | EMP006 |
| EMP008 · Salas | `CompanyRooms`, `RoomEditPanel`, ocultar y mostrar | M | UI007 |
| EMP009 · Fotos de sala | `RoomPhotosManager` (subir, ordenar, portada) | M | UI008, EMP008 |
| EMP010 · Reservas y bloqueos | `CompanyBookings`, `BlockHoursModal` | M | UI007 |
| EMP011 · Detalle de reserva | `CompanyBookingDetail` con cancelación | S | UI014 |
| EMP012 · Ajustes de cobros | `CompanySettings` (solo maqueta de Stripe Connect) | S | UI011 |
| EMP013 · _Extra_ Edificio 3D | `Building3D` | L | EMP007 |

## Épica 4 · `ADM` Admin (persona A, después de cliente)

Es la épica más ligera porque casi todo reutiliza piezas comunes (`DataTable`, `FilterBar`, `ConfirmModal`, `BookingDetail`, `StatCard`).

| Issue | Contenido | Tam. | Depende de |
| --- | --- | --- | --- |
| ADM001 · Resumen | `AdminDashboard` con `StatCard` (empresas pendientes, reservas, ingresos) | S | UI011, UI005 |
| ADM002 · Empresas | `AdminCompanies` con filtro por estado y botones de aprobar, rechazar y suspender | M | UI007, UI006 |
| ADM003 · Detalle de empresa | `AdminCompanyDetail` con los modales de rechazar y suspender (`ConfirmModal` con motivo) | M | ADM002 |
| ADM004 · Usuarios | `AdminUsers`, `RoleSelect` con confirmación del cambio de rol | M | UI007 |
| ADM005 · Reservas | `AdminBookings` y `AdminBookingDetail` | M | UI007, UI014 |
| ADM006 · Pagos | `AdminPayments` revisado y modal de reembolso | M | UI007, UI006 |

## Reparto y orden

| Fase | Persona A | Persona B |
| --- | --- | --- |
| 1 · Base | Se reparten UI001–UI015 por orden de llegada. Primero UI001, UI012 y UI015 | |
| 2 | CLI001 → CLI012 | EMP001 → EMP012 (el editor, EMP004, empieza en cuanto estén UI001 y UI002) |
| 3 | ADM001 → ADM006 | Lo que quede de empresa y ayuda en admin si acaba antes |
| 4 · Extras | CLI013, CLI014 | EMP013 |

Carga estimada: A ≈ 26 días (cliente + admin) y B ≈ 22 días (empresa). La diferencia compensa el riesgo del editor de mapas; si B acaba antes, coge issues de `ADM`.

**Reglas para no pisarse:**

- Cada componente común tiene un responsable, y hay que fijar sus props antes de usarlo, para poder usarlo sin esperar a que esté terminado.
- La fase 1 se fusiona antes de empezar las páginas que dependen de ella. Mientras tanto se puede maquetar con los datos de prueba.
- `App.jsx`, `constants.js` y `style.css` los tocan los dos: cambios en PRs pequeñas y avisando.

## Épica futura · `INT` Integración con la API

Cuando el back tenga endpoints, una issue por service para cambiar los datos de prueba por llamadas reales con `apiClient`. Hay que hacerlo también con Firebase Auth en el login, Stripe en el pago e IA en el editor. Como las páginas solo hablan con los services, no deberían cambiar.

Endpoints que el front va a necesitar y que hay que acordar con back:

- Búsqueda de edificios por ciudad, fecha y personas.
- Detalle de reserva (cliente, empresa y admin) y detalle de empresa (admin).
- Ocultar y mostrar sala.
- Stripe Connect para los cobros de las empresas.

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
   - Perfil de usuario.
   - Favoritos.
