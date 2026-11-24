# Inventario mockup cliente iPuente

Base: `docs/spec-cliente.md`. ➕ = añadido (la spec no lo dice). Alcance aprobado: 15 pantallas, sin páginas legales. El 3D y el mapa «Alrededor» van como imagen estática en los frames (nota: en la web son interactivos).

## Pantallas × elementos

| # | Pantalla | Secciones | Componentes | Estados | Overlays | Entra desde → sale a |
|---|---|---|---|---|---|---|
| 01 | Landing | Hero con edificio · buscador · salas destacadas con filtros · ➕ cómo funciona · ➕ alrededor · ¿Tienes oficinas? · footer | Header, SearchBar `hero`, CategoryFilters, RoomCard, Chip, Button, Footer, ➕ CookieBanner | Normal · cargando (skeleton) · vacío · error · ➕ hero sin 3D (móvil) | ➕ Cookies · menú móvil · ➕ ficha de sala en hoja | URL o logo → 12, 04 o 02; CTA empresas; Login/Registro |
| 12 ➕ | Resultados de búsqueda | Barra (ciudad, fecha, personas) · filtros · lista de edificios · mapa de resultados | SearchBar, CategoryFilters, BuildingCard, SearchMap, NumberStepper, Select, Pagination | Normal · cargando · sin resultados (con sugerencia) · error · fecha pasada o personas < 1 | Filtros en hoja (móvil) · desplegable de orden | 01 → 02 |
| 02 | Edificio | Cabecera · imagen con plantas clicables · plantas con salas libres · Qué hay cerca · mapa · ➕ selector de fecha | BuildingHero, FloorSelector, FloorList, NearbyMap, PoiMarker, Breadcrumbs, DatePicker | Normal · cargando · 404 · planta sin salas libres · error · mapa sin conexión | Tooltip de planta · ➕ detalle de lugar cercano | 12 o 01 → 03 |
| 03 | Planta | Cabecera · fecha/hora · plano cenital · sala seleccionada elevada · leyenda | FloorPlan, RoomShape, Legend, FloorSelector, RoomSidePanel, StatusBadge, DatePicker | Normal · cargando · sin mapa · sala seleccionada · hover/foco lima · todas ocupadas · ➕ sala que no encaja (atenuada) · error | Panel lateral (escritorio) o BottomSheet (móvil) | 02 → 04 |
| 04 | Ficha de sala | Galería · título, tipo y capacidad · equipamiento · precio · calendario · ➕ dónde está · CTA reservar | RoomGallery, AmenitiesList, AvailabilityCalendar, BookingForm, StickyActionBar, Breadcrumbs, Chip | Normal · cargando · sin fotos · gratis · ocupada o no se alquila (CTA desactivado con motivo) · día sin huecos · error · 404 | ➕ Visor de fotos · aviso de franja no válida | 03 → 07; sin sesión → 05 y vuelta |
| 05 | Login | Email/contraseña · Google · enlace a registro · ➕ ¿Olvidaste tu contraseña? | AuthLayout, Input, Button, Alert | Normal · enviando · credenciales erróneas · error de red · éxito · cuenta de otro rol | Ventana de Google (externa) | Cualquiera → origen |
| 06 | Registro | Nombre, apellidos, email, contraseña · Google (sin casilla de condiciones) | AuthLayout, Input, Button | Normal · enviando · email ya existe · contraseña corta · éxito | — | 05 ↔ 06 → origen o 01 |
| 13 ➕ | Recuperar contraseña (+ nueva contraseña) | Email · confirmación · formulario nuevo | AuthLayout, Input, Button, Alert | Normal · enviado · enlace caducado · error | — | 05 → 05 |
| 07 | Resumen y pago | Resumen · desglose · cuenta atrás (15 min) · «Ir a pagar» | BookingSummary, StickyActionBar, Button, Alert | Normal · cargando · tiempo agotado · reserva ajena · franja ocupada (409) · enviando · 0 € (sin Stripe) | Confirmar salida · aviso de caducidad | 04 → 08; agotado → 04 |
| 08 | Stripe (prueba) | Pantalla externa de Stripe Checkout | Solo referencia (marcar «externo») | Normal · tarjeta rechazada · cancelar | — | 07 → 09 |
| 09 | Resultado de pago | Confirmada · no completado · ➕ seguimos confirmando · caducada | Alert, Button, BookingSummary, ➕ Añadir al calendario | Comprobando (hasta 30 s) · OK · KO · pendiente · caducada · error de red | — | 08 → 10 o 15; KO → 07 o 04 |
| 10 | Mis reservas | Próximas · pasadas · cancelar | BookingCard, Tabs, StatusBadge, EmptyState, ConfirmModal | Normal · cargando · vacío (CTA «Explorar») · error · cancelada (toast) · pendiente de pago · cancelada/caducada | Confirmar cancelación (importe y reembolso) · toast | Header o 09 → 15 o 01 |
| 15 ➕ | Detalle de reserva | Código IP-n, sala, planta, fecha, importe, estado · cómo llegar · cancelar · pagar | BookingDetail, Breadcrumbs, Button | Normal · cargando · 404 · cancelada (quién y motivo) · pendiente | Confirmar cancelación | 10 → 10 |
| 14 ➕ | Mi cuenta | Mis datos · cambiar contraseña | Input, Button, Alert | Normal · guardando · éxito (toast) · error · cuenta de Google (sin contraseña) | — | Menú de usuario → origen |
| 11 | 404 | Mensaje · enlaces a inicio y buscar | EmptyState, Button | Único | — | URL inexistente → 01 |

**Header (todas):** sin sesión: logo, enlaces, Entrar, Registrarse. Con sesión: logo, enlaces, menú de usuario (Mis reservas, Mi cuenta, panel si es empresa o admin, Cerrar sesión). En móvil, ambos pasan al menú móvil.

## Componentes compartidos

| Grupo | Componentes |
|---|---|
| Marca y layout | Logo, Header (con y sin sesión), UserMenu, MobileMenu, Footer, AuthLayout, Breadcrumbs, BackLink |
| Acciones | Button (primario, secundario, fantasma; md y lg; cargando y desactivado), IconButton, Chip, ActionMenu |
| Formularios | Input, NumberStepper, Select, Checkbox, Radio, Textarea ➕, DatePicker ➕, TimeRangePicker ➕ |
| Feedback | Alert, Toast ➕, Spinner, Skeleton ➕, EmptyState, ErrorState, StatusBadge |
| Overlays | Modal, ConfirmModal, BottomSheet, SidePanel, StickyActionBar, Tooltip ➕, CookieBanner |
| Dominio | SearchBar, CategoryFilters, BuildingCard, RoomCard, FloorSelector, FloorPlan + RoomShape + Legend, RoomSidePanel, RoomGallery, AmenitiesList, AvailabilityCalendar, BookingForm, BookingSummary, BookingCard, BookingDetail, BuildingHero, NearbyMap + PoiMarker, SearchMap |
| Foundations (00) | Variables de color, estilos de texto, espaciado y radios ➕, sombras de «elevado» ➕, trama de «No se alquila», símbolo y trazo del estado, anillo de foco lima, iconos |

## Reglas transversales

Frames Desktop 1440 + Mobile 390 · estados normal, vacío, cargando, error, éxito · hover, foco lima, deshabilitado, seleccionado · textos reales en español · contraste AA · el estado de una sala nunca solo por color.
