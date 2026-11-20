# Funciones de los wireframes frente a la API

**La API manda:** el diseño y la estructura del front se adaptan a lo que ofrece la API de `main`. Si un wireframe pide algo que la API no tiene, se cambia la pantalla, no la API. Este documento recoge, wireframe a wireframe, qué hay que adaptar.

Revisado con `main` en `34001c7` (20 nov 2026). Los wireframes están en `docs/images/wireframes/`.

**Cómo leerlo:**

- **Sección 1:** lo que se adapta en la pantalla porque la API no lo tiene.
- **Sección 2:** lo que tiene issue de back abierta; hasta entonces lleva datos de prueba (UI015, #74).
- **Sección 3:** diferencias entre el wireframe y la API, resueltas siempre a favor de la API.
- **Sección 4:** lo que sale en los wireframes pero no necesita API.

Las pantallas que no aparecen aquí (p. ej. `03` Planta, `14` Salas o `10b` Estado de la solicitud) ya encajan con la API.

## 1. Lo que se adapta en la pantalla

| Wireframe pide | Wireframes | Qué hace el front con la API actual |
| --- | --- | --- |
| Salas destacadas en la Landing | [`01`](images/wireframes/01-landing-escritorio.png) | Edificios destacados con `GET /buildings`: foto, nombre, ciudad, `salasDisponibles` y `precioDesde`. |
| Chips con las salas libres de cada edificio («Black Room I · 25 €/h», «+3 salas») | [`22`](images/wireframes/22-busqueda-escritorio.png) | Una línea «N salas libres · desde X €/h» con `salasDisponibles` y `precioDesde`. |
| Ordenar por «más cerca» | [`22`](images/wireframes/22-busqueda-escritorio.png) | Ordenar por «Precio» o «Más salas libres» (`orden=precio` o `orden=salas`). |
| Imagen de la fachada con una zona clicable por planta | [`01`](images/wireframes/01-landing-escritorio.png), [`02`](images/wireframes/02-edificio-escritorio.png) | Lista de plantas con `plantas[].nombre` y `salasLibres` de `GET /buildings/:id`, sin imagen por zonas. |
| «Dibujar zona» de cada planta sobre la fachada | [`12b`](images/wireframes/12b-empresa-edificio-formulario.png), [`12c`](images/wireframes/12c-empresa-edificio-menu.png) | Se quita del formulario. |
| «Gestionado por Oficinas Sur SL» | [`02`](images/wireframes/02-edificio-escritorio.png) | Se quita: `GET /buildings/:id` no incluye la empresa. |
| Planta visible pero no reservable («Planta baja · Recepción · no reservable») | [`02`](images/wireframes/02-edificio-escritorio.png) | No aparece: solo salen las plantas publicadas, y una planta publicada siempre tiene salas reservables. |
| Casilla «Tiene salas» de cada planta | [`12b`](images/wireframes/12b-empresa-edificio-formulario.png), [`12c`](images/wireframes/12c-empresa-edificio-menu.png) | Se quita. |
| Ordenar plantas con flechas y «Posición: encima de Planta 3» | [`12b`](images/wireframes/12b-empresa-edificio-formulario.png), [`12c`](images/wireframes/12c-empresa-edificio-menu.png) | Campo «Número de planta» (`numero`) al crear y editar; la lista se ordena por número. Un número repetido muestra el error `409 FLOOR_EXISTS`. |
| Sección «Qué hay cerca» | [`02`](images/wireframes/02-edificio-escritorio.png), [`12b`](images/wireframes/12b-empresa-edificio-formulario.png) | Se quita. |
| Mapas del edificio («Cómo llegar», mapa de resultados) | [`04`](images/wireframes/04-sala-escritorio.png), [`09b`](images/wireframes/09b-detalle-reserva.png), [`22`](images/wireframes/22-busqueda-escritorio.png) | Dirección en texto (`direccion`, `ciudad`). Al crear o editar un edificio no se guardan coordenadas, así que no se pinta un mapa. |
| Asistentes de la reserva | [`04`](images/wireframes/04-sala-escritorio.png), [`07`](images/wireframes/07-resumen-pago.png), [`09b`](images/wireframes/09b-detalle-reserva.png), [`15b`](images/wireframes/15b-empresa-detalle-reserva.png) | Se quita el campo y la fila. |
| Foto, edificio y planta en cada fila de «Mis reservas» | [`09`](images/wireframes/09-mis-reservas-escritorio.png) | La fila muestra lo que da `GET /bookings/me`: sala, fecha, horario, importe y estado. Edificio y planta, en el detalle (`GET /bookings/:id`). Sin foto. |
| «Repetir» un bloqueo de horas | [`15d`](images/wireframes/15d-empresa-modal-bloquear-horas.png) | Se quita: cada bloqueo es una franja de un día. |
| «Cambiar rol» de un usuario | [`18`](images/wireframes/18-admin-usuarios.png) | Se quita: la tabla de usuarios es de solo lectura (filtro por rol y búsqueda). |
| Filtro por ciudad y columna «Edificios» en la lista de empresas | [`17`](images/wireframes/17-admin-empresas.png) | Solo filtro por estado. Columnas: empresa, CIF, fecha de solicitud y estado. Los edificios, en el detalle (`17b`). |
| «Actividad reciente» | [`16`](images/wireframes/16-admin-resumen.png) | Se quita. El resumen usa `GET /admin/summary` (empresas por estado, usuarios por rol, reservas del mes) y la tabla de empresas pendientes. |
| «Historial» de la empresa y de la reserva | [`17b`](images/wireframes/17b-admin-detalle-empresa.png), [`19b`](images/wireframes/19b-admin-detalle-reserva.png) | Las fechas que da la API: solicitud y revisión de la empresa; creación y cancelación de la reserva. |

## 2. Lo que tiene issue de back abierta

Hasta que se haga la issue, el service devuelve datos de prueba con un `TODO(DATxxx)` (UI015, #74). Los extras se quedan en maqueta.

| Función | Wireframes | Issue |
| --- | --- | --- |
| Resumen del panel de empresa (cifras, próximas reservas, tareas pendientes, primer acceso) | [`11`](images/wireframes/11-empresa-resumen.png), [`11b`](images/wireframes/11b-empresa-primer-acceso.png) | DAT029 (#159) |
| Editar y reenviar la solicitud de alta; pestaña «Empresa» de Ajustes | [`10b`](images/wireframes/10b-empresa-solicitud-estado.png), [`25`](images/wireframes/25-empresa-ajustes-cobros.png) | DAT030 (#160) |
| Eliminar edificio, planta o sala, bloqueado con reservas futuras | [`12b`](images/wireframes/12b-empresa-edificio-formulario.png), [`12c`](images/wireframes/12c-empresa-edificio-menu.png), [`13`](images/wireframes/13-empresa-editor-mapas.png) | DAT028 (#158) |
| Detección de salas con IA | [`13`](images/wireframes/13-empresa-editor-mapas.png), [`13b`](images/wireframes/13b-empresa-editor-analizando.png), [`13e`](images/wireframes/13e-empresa-editor-ia-o-manual.png), [`13f`](images/wireframes/13f-empresa-editor-error-deteccion.png) | DAT040 (#180, en pausa) |
| _Extra:_ pago con Stripe, pendiente de pago, tiempo agotado, resultado del pago, factura y tarjeta | [`07`](images/wireframes/07-resumen-pago.png), [`07b`](images/wireframes/07b-pago-movil.png), [`07c`](images/wireframes/07c-reserva-expirada.png), [`08`](images/wireframes/08-resultado-pago.png), [`09`](images/wireframes/09-mis-reservas-escritorio.png), [`09b`](images/wireframes/09b-detalle-reserva.png) | DAT033 (#163) |
| _Extra:_ reembolso al cancelar con más de 24 h | [`09b`](images/wireframes/09b-detalle-reserva.png), [`09c`](images/wireframes/09c-modal-cancelar-reserva.png) | DAT033 (#163) |
| _Extra:_ comisiones, pagos y reembolsos; ingresos del mes | [`15b`](images/wireframes/15b-empresa-detalle-reserva.png), [`16`](images/wireframes/16-admin-resumen.png), [`19b`](images/wireframes/19b-admin-detalle-reserva.png), [`20`](images/wireframes/20-admin-pagos.png), [`20b`](images/wireframes/20b-admin-modal-reembolso.png) | DAT033 (#163) |
| _Extra:_ cuenta de cobro con Stripe Connect (estados, movimientos, bloqueo al publicar) | [`11b`](images/wireframes/11b-empresa-primer-acceso.png), [`13d`](images/wireframes/13d-empresa-editor-validar-publicar.png), [`17b`](images/wireframes/17b-admin-detalle-empresa.png), [`25`](images/wireframes/25-empresa-ajustes-cobros.png) | DAT033 (#163) |
| _Extra:_ inicio de sesión con Google | [`05`](images/wireframes/05-login.png), [`06`](images/wireframes/06-registro.png) | DAT032 (#162) |
| _Extra:_ emails (reserva confirmada, empresa aprobada) | [`08`](images/wireframes/08-resultado-pago.png), [`10`](images/wireframes/10-empresa-alta.png), [`17b`](images/wireframes/17b-admin-detalle-empresa.png) | DAT037 (#167) |

## 3. Diferencias resueltas a favor de la API

| Wireframe | Se hace como la API | Wireframes |
| --- | --- | --- |
| Categorías «Reuniones», «Eventos y charlas», «Formación» y «Boxes privados» | Filtros «Todas», «Salas» y «Boxes» (`tipo=sala` o `tipo=box`). | [`01`](images/wireframes/01-landing-escritorio.png), [`22`](images/wireframes/22-busqueda-escritorio.png) |
| «Guardar borrador» y «Guardar edificio» | Un solo «Guardar»: el edificio nace en borrador y se publica aparte (`/publish`). | [`12b`](images/wireframes/12b-empresa-edificio-formulario.png) |
| Estado «Finalizada» | La API no pasa las reservas a `COMPLETED`: la pantalla muestra «Finalizada» si una reserva `CONFIRMED` ya terminó. | [`09`](images/wireframes/09-mis-reservas-escritorio.png) |
| Aviso de choque con el nombre del cliente («Ana García, 12:00 – 14:00») | Mensaje de `409 SLOT_TAKEN` («Esa franja ya está ocupada»). | [`15d`](images/wireframes/15d-empresa-modal-bloquear-horas.png) |
| Foto de portada y orden de las fotos | El orden es el del array `fotos` y la portada es la primera. | [`04`](images/wireframes/04-sala-escritorio.png), [`13`](images/wireframes/13-empresa-editor-mapas.png) |

## 4. Lo que no necesita API

| Función | Wireframes | Cómo se hace |
| --- | --- | --- |
| Recuperar contraseña | [`05b`](images/wireframes/05b-recuperar-contrasena-enlace.png), [`05c`](images/wireframes/05c-recuperar-contrasena-nueva.png) | Firebase Auth desde el navegador. |
| Cuenta de acceso (email y contraseña) | [`25`](images/wireframes/25-empresa-ajustes-cobros.png) | Firebase Auth desde el navegador. |
| Aceptar condiciones y política de privacidad | [`06`](images/wireframes/06-registro.png), [`10`](images/wireframes/10-empresa-alta.png) | Casilla obligatoria en el formulario. |
| «Escribir al cliente» | [`15b`](images/wireframes/15b-empresa-detalle-reserva.png) | Enlace `mailto:` con el email que ya da la API. |
| Banner de cookies, 404, error del servidor y menús | [`21`](images/wireframes/21-404.png), [`21b`](images/wireframes/21b-error-servidor.png), [`23`](images/wireframes/23-banner-cookies.png), [`24`](images/wireframes/24-menu-movil.png) | Solo front. |
| Bloqueos en la tabla de reservas con estado «Bloqueada» | [`15`](images/wireframes/15-empresa-reservas.png), [`15b`](images/wireframes/15b-empresa-detalle-reserva.png) | El front une `GET /company/bookings` y `GET /company/blocks`. |
