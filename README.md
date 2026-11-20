# iPuente
 
iPuente es un portal donde las empresas publican sus oficinas y salas, y los clientes las alquilan por horas: eligen el edificio, la planta en un modelo 3D y la sala en su plano, y ven su precio, capacidad y equipamiento antes de reservar. Cada empresa sube la imagen de su plano, iPuente detecta las salas automáticamente y genera el mapa interactivo y el edificio 3D, que la empresa revisa y publica desde su propio panel.
 
## Índice
 
- [Problema que resuelve](#problema-que-resuelve)
- [Cómo funciona](#cómo-funciona)
- [Por qué Firebase](#por-qué-firebase)
- [Usuarios objetivo](#usuarios-objetivo)
- [Roles](#roles)
- [Historias de usuario](#historias-de-usuario)
- [Alcance del MVP](#alcance-del-mvp)
- [Diseño de datos](#diseño-de-datos)
- [Convenciones de trabajo](#convenciones-de-trabajo)
- [Prototipo navegable del flujo principal](#Prototipo-navegable-del-flujo-principal)
- [Guía de estilo](#guía-de-estilo)

  
## Problema que resuelve
 
**Para los clientes:** hoy, quien quiere alquilar una sala para una charla, una reunión o un evento lo hace a ciegas. No sabe cómo es el espacio, si cabe su gente, qué equipamiento tiene ni si está libre, y muchas veces tiene que ir en persona o escribir para preguntarlo.
 
**Para las empresas que alquilan espacios:** mostrar sus oficinas de forma visual exige fotos, planos y una web propia, y las reservas se gestionan a mano por correo o teléfono, con solapes y huecos perdidos.
 
iPuente une las dos partes en un mismo sitio. La empresa convierte su plano en un mapa interactivo en minutos, sin dibujar desde cero. El cliente ve el edificio, el plano de cada planta y la disponibilidad real de cada sala, y reserva sin intermediarios.
 
## Cómo funciona
 
### Para la empresa
 
1. Se registra como empresa y da de alta su edificio con el número de plantas.
2. En cada planta sube la imagen de su plano (PNG o JPG).
3. Un modelo de IA con visión analiza la imagen y devuelve un primer borrador con las salas detectadas: nombre, código y posición.
4. El editor de mapas muestra el plano de fondo con las salas detectadas encima. La empresa mueve, ajusta, borra o añade salas, o las dibuja a mano si la detección falla.
5. Completa los datos de cada sala (precio por hora, capacidad, m², equipamiento, fotos) y la publica.
6. Con las plantas guardadas, iPuente genera automáticamente el edificio 3D, con las plantas apiladas y cada sala como un bloque.
### Para el cliente
 
1. Busca un edificio y lo explora en 3D.
2. Pulsa una planta y ve su plano con las salas libres, ocupadas y no reservables.
3. Pulsa una sala y ve su ficha: precio, capacidad, equipamiento, fotos y huecos libres.
4. Reserva por fecha y franja horaria; la reserva queda confirmada al hacerla (el pago online con Stripe es un extra).



## Por qué Firebase
 
- **Autenticación resuelta y segura.** Firebase Auth gestiona el registro con email y con Google, la recuperación de contraseña y los tokens de sesión. Las contraseñas nunca pasan por nuestro código ni por nuestra base de datos, así que reducimos el riesgo de una brecha de seguridad.
- **NoSQL encaja con el modelo.** Tenemos pocas entidades (usuarios, empresas, edificios, plantas, salas, reservas y pagos), relacionadas de forma simple por id. Además, el mapa de cada planta es un documento JSON con la lista de salas y sus posiciones: se guarda y se lee de una vez, que es justo como lo usan el editor, el plano y el modelo 3D.
- **Disponibilidad siempre al día.** El servidor calcula los huecos libres de cada sala en el momento de consultarla, a partir de su horario, sus reservas y sus bloqueos, así que el plano muestra siempre la ocupación real sin guardar los horarios libres por separado.
- **Archivos en el mismo sitio.** Firebase Storage guarda los planos y las fotos de las salas, y Firestore solo conserva su URL y su ruta.
- **Seguridad por rol en la propia base de datos.** Con las reglas de Firestore, los edificios y planos publicados son de lectura pública, cada empresa solo puede ver lo suyo, y reservas, pagos y roles solo se escriben desde nuestras funciones del servidor.
- **Sin servidor que mantener.** El plan gratuito cubre el proyecto, y Firebase se integra con las funciones de Vercel mediante `firebase-admin` para la lógica protegida: reservas, pagos con Stripe (extra) y análisis de planos con IA, cuyas claves nunca llegan al navegador.
**Frente a Supabase (PostgreSQL):** Supabase sería mejor opción con un modelo muy relacional o con informes complejos en SQL. Para un proyecto de pocas semanas y un modelo sencillo, Firebase nos da autenticación, base de datos y almacenamiento de archivos con menos configuración.
 
**Limitaciones que asumimos:** Firestore no impide por sí solo que dos reservas se solapen, así que lo comprobamos con una transacción en una función del servidor. Las estadísticas de los paneles también se calculan en funciones, porque Firestore no tiene consultas de agregación tan potentes como SQL.
 
## Usuarios objetivo
 
- **Empresas y profesionales** que necesitan una sala por horas para charlas, formaciones, reuniones, presentaciones o eventos.
- **Empresas propietarias o gestoras de oficinas y coworkings** que quieren alquilar sus salas y mostrarlas de forma visual sin montar una web propia.
- **Equipo de iPuente**, que aprueba empresas y supervisa la plataforma.


## Roles
 
| Rol | Quién es | Qué puede hacer |
| --- | --- | --- |
| Visitante | Cualquiera sin cuenta | Explorar edificios en 3D, plantas, planos y fichas con precios. Al reservar se le pide registro. |
| Cliente | Persona o empresa que alquila | Reservar, ver y cancelar sus reservas, editar su perfil, guardar salas favoritas. |
| Empresa | Propietaria o gestora de un espacio | Dar de alta edificios y plantas, subir planos, usar el editor de mapas, gestionar sus salas y ver las reservas de sus espacios. Solo ve y modifica lo suyo. |
| Admin | Equipo de iPuente | Aprobar o suspender empresas, gestionar usuarios y roles, ver todas las reservas (pagos y reembolsos: extra). |
 
Nadie puede registrarse como admin, y las cuentas de empresa quedan pendientes hasta que un admin las aprueba.
 
## Historias de usuario
 
| ID | Historia |
| --- | --- |
| HU-01 | Como **visitante**, quiero explorar un edificio en 3D y elegir una planta, para hacerme una idea del espacio sin ir en persona. |
| HU-02 | Como **visitante**, quiero ver en el plano de cada planta qué salas están libres en una fecha, para saber rápido qué opciones tengo. |
| HU-03 | Como **visitante**, quiero ver el precio, la capacidad, los m² y el equipamiento de una sala, para saber si encaja con mi evento antes de registrarme. |
| HU-04 | Como **visitante**, quiero registrarme con mi email o mi cuenta de Google (Google: extra), para poder reservar sin rellenar formularios largos. |
| HU-05 | Como **cliente**, quiero reservar una sala por fecha y franja horaria, para cerrar el alquiler en un solo paso. |
| HU-06 | Como **cliente**, quiero ver y cancelar mis reservas, para gestionar cambios de planes sin llamar a nadie. |
| HU-07 | Como **empresa**, quiero registrarme y dar de alta mi edificio con sus plantas, para publicar mis espacios en el portal. |
| HU-08 | Como **empresa**, quiero subir la imagen de mi plano y que se detecten las salas automáticamente, para no tener que dibujar el mapa desde cero. |
| HU-09 | Como **empresa**, quiero corregir el mapa detectado o dibujar las salas a mano sobre mi plano, para que el mapa publicado sea exacto. |
| HU-10 | Como **empresa**, quiero indicar el precio, la capacidad, el equipamiento y las fotos de cada sala, para que los clientes tengan toda la información. |
| HU-11 | Como **empresa**, quiero ver las reservas de mis salas y bloquear horas, para controlar la ocupación de mis espacios. |
| HU-12 | Como **admin**, quiero aprobar o suspender empresas, para que solo se publiquen espacios reales. |
| HU-13 | Como **admin**, quiero ver todas las reservas y pagos y hacer reembolsos (pagos y reembolsos: extra), para resolver incidencias. |
 
## Alcance del MVP
 
### Funcionalidades obligatorias (entran en el MVP)
 
| # | Funcionalidad | Historias |
| --- | --- | --- |
| 1 | Registro e inicio de sesión con email; roles de cliente, empresa y admin | HU-04, HU-07 |
| 2 | Alta de empresa, edificio y plantas | HU-07 |
| 3 | Editor de mapas: plano subido como fondo y salas como rectángulos que se dibujan, mueven, redimensionan y nombran | HU-09 |
| 4 | Detección automática de salas a partir de la imagen del plano, con IA, como borrador editable | HU-08 |
| 5 | Guardar el mapa de cada planta en Firestore | HU-08, HU-09 |
| 6 | Datos de cada sala: precio por hora, capacidad, m², equipamiento y fotos | HU-10 |
| 7 | Plano 2D clicable para clientes, con colores según el estado de cada sala (libre, ocupada, no reservable) | HU-02 |
| 8 | Selector de hora que actualiza la ocupación del plano | HU-02 |
| 9 | Buscador de edificios por ciudad, capacidad y equipamiento | HU-01 |
| 10 | Ficha de sala con huecos libres | HU-03 |
| 11 | Reserva por fecha y franja horaria, sin solapes; la reserva queda confirmada al hacerla, sin pago online | HU-05 |
| 12 | «Mis reservas»: consultar y cancelar | HU-06 |
| 13 | Panel de empresa: sus salas, reservas y bloqueos | HU-11 |
| 14 | Panel de admin: aprobar empresas y consultar usuarios y reservas | HU-12, HU-13 |
| 15 | Diseño responsive (móvil, tablet y escritorio) | Todas |
 
**Orden de desarrollo:** primero el editor manual (punto 3), que garantiza que siempre haya mapa; después la detección automática (punto 4), que rellena ese mismo editor. Si falta tiempo, la detección automática es lo primero que se recorta y el portal sigue funcionando.
 
### Extras (solo si el MVP está terminado, por orden de prioridad)
 
1. Inicio de sesión con Google, además del registro con email.
2. Pago online con Stripe en modo de prueba, a una cuenta única de la plataforma, y gestión de pagos y reembolsos desde el panel de admin. Hasta entonces, la reserva se confirma sin pago.
3. Edificio 3D generado a partir de las plantas guardadas (Three.js): plantas apiladas y cada sala como un bloque. Mientras no esté, la landing usa una imagen del edificio con zonas clicables por planta.
4. Filtro por necesidades que resalta en el plano las salas que encajan.
5. Vista 360º de cada sala desde su ficha.
6. Dashboard con gráficas de ocupación e ingresos para empresas y admin.
7. Emails de confirmación y recordatorio.
8. Valoraciones de las salas tras usarlas.


### Fuera de alcance (no se hará en este proyecto)
 
- **Modelo 3D a partir de una foto del edificio.** Los servicios de IA que lo hacen devuelven un único bloque decorativo, sin plantas separadas, y no permitiría hacer clic por plantas.
- **Detección de planos complejos de arquitecto** (paredes finas, cotas, formas irregulares): la detección automática está pensada para planos de bloques rectangulares; el resto se dibuja a mano en el editor.
- **Cobro directo a cada empresa (Stripe Connect)**, pagos reales y facturación con validez fiscal.
- Alquiler mensual de oficinas con contrato.
- App móvil nativa.
- Integración con el control de accesos de los edificios.




# Diseño de datos

Esta sección documenta el diseño de la base de datos de iPuente: las colecciones de Firestore, sus campos, las relaciones entre documentos y los criterios de almacenamiento.

El objetivo es mantener una estructura que permita gestionar usuarios, empresas, edificios, plantas, salas, reservas y pagos, además de facilitar las consultas necesarias para los distintos paneles de la aplicación.

## 1. Estructura de colecciones

La estructura principal propuesta es:

| Colección | Descripción |
| --- | --- |
| `users` | Usuarios registrados en la plataforma. |
| `companies` | Empresas que publican y gestionan espacios. |
| `buildings` | Edificios dados de alta por las empresas. |
| `floors` | Plantas pertenecientes a cada edificio y sus mapas. |
| `rooms` | Salas y espacios disponibles para alquilar. |
| `blocks` | Horas bloqueadas por la empresa en una sala. |
| `occupancy` | Una ficha por sala y hora ocupada, con id `roomId_AAAA-MM-DD_HH`; impide reservas dobles. |
| `bookings` | Reservas realizadas por los clientes. |
| `payments` | Operaciones de pago asociadas a las reservas. |
| `favorites` | Salas guardadas como favoritas por los usuarios. |

Subcolecciones previstas:

- `companies/{companyId}/members`: usuarios que pertenecen a una empresa y sus permisos.

## 2. Definición de colecciones

### `users`

Almacena los datos de los usuarios registrados. El identificador del documento coincide con el UID proporcionado por Firebase Authentication.

| Campo | Descripción |
| --- | --- |
| `name` | Nombre del usuario. |
| `surname` | Apellidos. |
| `email` | Correo electrónico. |
| `phone` | Teléfono de contacto. |
| `role` | Rol del usuario: `CLIENT`, `COMPANY` o `ADMIN`. |
| `createdAt` | Fecha de creación. |
| `updatedAt` | Última actualización. |

### `companies`

Almacena la información de las empresas que publican espacios.

| Campo | Descripción |
| --- | --- |
| `name` | Nombre comercial. |
| `legalName` | Razón social. |
| `taxId` | Identificador fiscal (CIF normalizado: mayúsculas, sin espacios ni guiones). |
| `contactName` | Persona de contacto. |
| `description` | Descripción de la empresa. |
| `logoUrl` | URL del logotipo. |
| `email` | Correo de contacto. |
| `phone` | Teléfono de contacto. |
| `address` | Dirección de la empresa. |
| `ownerUid` | UID del usuario que dio de alta la empresa. |
| `status` | Estado de la solicitud: `PENDING`, `APPROVED`, `REJECTED` o `SUSPENDED`. |
| `verified` | `true` si `status` es `APPROVED`. |
| `rejectionReason` | Motivo del rechazo (lo escribe el admin al rechazar). |
| `suspensionReason` | Motivo de la suspensión vigente; `null` al reactivar. |
| `lastSuspensionReason` | Motivo de la última suspensión, guardado al reactivar. |
| `reviewedAt` | Fecha de la última decisión del admin. |
| `reviewedBy` | UID del admin que tomó la última decisión. |
| `createdAt` | Fecha de creación. |
| `updatedAt` | Última actualización. |

**Subcolección `members`**

Relaciona usuarios con empresas y define sus permisos.

| Campo | Descripción |
| --- | --- |
| `userId` | Identificador del usuario. |
| `role` | Permiso dentro de la empresa: `OWNER`, `MANAGER` o `EMPLOYEE`. |
| `joinedAt` | Fecha de incorporación. |

### `buildings`

Almacena los edificios publicados por las empresas.

| Campo | Descripción |
| --- | --- |
| `companyId` | Empresa propietaria o gestora. |
| `name` | Nombre del edificio. |
| `description` | Descripción del edificio. |
| `address` | Dirección. |
| `city` | Ciudad. |
| `postalCode` | Código postal. |
| `country` | País. |
| `latitude` | Latitud. |
| `longitude` | Longitud. |
| `floorCount` | Número de plantas. |
| `photos` | Lista de URLs de fotos del edificio. |
| `status` | Estado del edificio: `DRAFT` (borrador) o `PUBLISHED` (publicado). |
| `deletedAt` | Borrado lógico: solo si alguna de sus salas tuvo reservas; deja de verse en todas partes salvo en el historial de reservas. Sin ese campo, el edificio existe. |
| `createdAt` | Fecha de creación. |
| `updatedAt` | Última actualización. |

### `floors`

Contiene la información de las plantas y los datos necesarios para representar sus mapas.

| Campo | Descripción |
| --- | --- |
| `companyId` | Empresa propietaria o gestora. |
| `buildingId` | Identificador del edificio al que pertenece. |
| `name` | Nombre o denominación de la planta. |
| `level` | Número o nivel de planta. |
| `mapImageUrl` | URL de la imagen original del plano. |
| `ancho` | Ancho del plano, en las unidades del editor. |
| `alto` | Alto del plano, en las unidades del editor. |
| `origen` | Cómo se creó el mapa: `manual` o `ia`. |
| `salas` | Lista de salas del mapa: `{ id, codigo, nombre, tipo, x, y, w, h }`. El `id` es el id de su documento en `rooms`. |
| `status` | Estado de la planta: `DRAFT` (borrador) o `PUBLISHED` (publicada). |
| `deletedAt` | Borrado lógico: solo si alguna de sus salas tuvo reservas (conserva su mapa para el historial, pero no se muestra ni cuenta su número). |
| `createdAt` | Fecha de creación. |
| `updatedAt` | Última actualización. |

Los campos del mapa (`ancho`, `alto`, `origen` y `salas`) son los mismos que usan el editor, el plano de los clientes y la API, y se guardan y se leen de una vez. `tipo` es `sala`, `box`, `comun`, `cocina` o `pasillo`. Hay ejemplos en `server/scripts/data/floor-0.json` a `floor-3.json`.

### `rooms`

Almacena la información de cada sala o espacio que puede alquilarse. El id de cada documento es el `id` de la sala en `floors.salas`.

| Campo | Descripción |
| --- | --- |
| `companyId` | Empresa propietaria o gestora. |
| `buildingId` | Edificio al que pertenece. |
| `floorId` | Planta en la que se encuentra. |
| `name` | Nombre de la sala. |
| `code` | Código identificativo de la sala. |
| `type` | Tipo de espacio: `sala`, `box`, `comun`, `cocina` o `pasillo`. |
| `description` | Descripción del espacio. |
| `surface` | Superficie en metros cuadrados. |
| `capacity` | Capacidad máxima de personas. |
| `price` | Precio por hora. |
| `pricePeriod` | Periodo de facturación, inicialmente `HOUR`. |
| `amenities` | Equipamiento y servicios disponibles. |
| `photos` | Lista de URLs de fotos de la sala. |
| `bookable` | Indica si la empresa la ofrece para reservar. |
| `status` | `ACTIVE` o `INACTIVE` (la sala ya no está en el mapa de su planta; no se borra para conservar sus reservas). |
| `openingHours` | Horario habitual en el que se puede alquilar (de momento `null`: se usa el horario reservable de 8 a 20). |
| `deletedAt` | Borrado lógico al eliminar la sala: solo si tuvo reservas (pasa a `INACTIVE` y no reservable; su id no se reutiliza en el mapa). |
| `createdAt` | Fecha de creación. |
| `updatedAt` | Última actualización. |

### `blocks`

Almacena los periodos en los que la empresa bloquea manualmente una sala. Por ejemplo, cuando necesita utilizarla para sus propias actividades o realizar tareas de mantenimiento.

| Campo | Descripción |
| --- | --- |
| `companyId` | Empresa propietaria de la sala. |
| `roomId` | Sala bloqueada. |
| `startDate` | Fecha y hora de inicio del bloqueo. |
| `endDate` | Fecha y hora de finalización. |
| `reason` | Motivo del bloqueo. |
| `createdAt` | Fecha de creación. |
| `updatedAt` | Última actualización. |

Los bloqueos no representan reservas de clientes. Su única función es impedir que esos intervalos se puedan alquilar.

### `occupancy`

Una ficha por sala y hora ocupada, con id fijo `roomId_AAAA-MM-DD_HH` (por ejemplo, `p0-s01_2026-11-18_09`). Como el id es único, dos reservas no pueden ocupar la misma hora: la segunda falla dentro de la transacción. No guarda datos del cliente.

| Campo | Descripción |
| --- | --- |
| `companyId` | Empresa propietaria de la sala. |
| `roomId` | Sala ocupada. |
| `date` | Día, en formato `AAAA-MM-DD`. |
| `hour` | Hora de inicio (0-23). |
| `bookingId` o `blockId` | Reserva o bloqueo que ocupa esa hora. |
| `createdAt` | Fecha de creación. |
| `updatedAt` | Última actualización. |

### `bookings`

Almacena las reservas realizadas por los clientes.

| Campo | Descripción |
| --- | --- |
| `userId` | Cliente que realiza la reserva. |
| `companyId` | Empresa propietaria de la sala. |
| `roomId` | Sala reservada. |
| `startDate` | Fecha y hora de inicio. |
| `endDate` | Fecha y hora de finalización. |
| `price` | Precio aplicado por hora. |
| `pricePeriod` | Periodo de facturación: `HOUR`. |
| `totalAmount` | Importe total de la reserva. |
| `status` | Estado de la reserva. |
| `paymentId` | Identificador del pago asociado (`null` mientras no haya pago online). |
| `cancelledAt` | Fecha de cancelación, si se cancela. |
| `createdAt` | Fecha de creación. |
| `updatedAt` | Última actualización. |

Estados posibles:

- `CONFIRMED`: reserva hecha. En el MVP la reserva nace así, sin pago online.
- `CANCELLED`: reserva cancelada.
- `COMPLETED`: alquiler finalizado.
- `PENDING_PAYMENT`: pendiente de completar el pago. Solo con el extra de Stripe.
- `EXPIRED`: reserva provisional caducada sin pagar. Solo con el extra de Stripe.

### `payments`

Registra las operaciones de pago realizadas mediante Stripe. Solo se usa con el extra de pago online.

| Campo | Descripción |
| --- | --- |
| `bookingId` | Reserva asociada al pago. |
| `userId` | Cliente que realiza el pago. |
| `amount` | Importe cobrado. |
| `currency` | Moneda, inicialmente `EUR`. |
| `provider` | Proveedor del pago: `STRIPE`. |
| `providerPaymentId` | Identificador de la operación en Stripe. |
| `status` | Estado del pago. |
| `createdAt` | Fecha de creación. |
| `updatedAt` | Última actualización. |

Estados posibles:

- `PENDING`: pago iniciado.
- `SUCCEEDED`: pago completado correctamente.
- `FAILED`: pago fallido.
- `REFUNDED`: importe reembolsado.

### `favorites`

Almacena las salas que un usuario ha guardado como favoritas.

La estructura concreta de esta colección se definirá durante el desarrollo. Cada favorito deberá poder relacionarse con un usuario y una sala.

## 3. Relaciones entre colecciones

Aunque Firestore es una base de datos NoSQL y no utiliza claves foráneas como una base de datos relacional, podemos representar las relaciones mediante identificadores de documentos.

| Relación | Tipo | Implementación |
| --- | --- | --- |
| Empresa - Miembros | N | Subcolección `members`. |
| Empresa - Edificios | 1 | `companyId` en `buildings`. |
| Edificio - Plantas | 1 | `buildingId` en `floors`. |
| Planta - Salas | 1 | `floorId` en `rooms`. |
| Sala - Bloqueos | 1 | `roomId` en `blocks`. |
| Sala - Ocupación | 1 | `roomId` en `occupancy`. |
| Usuario - Reservas | 1 | `userId` en `bookings`. |
| Sala - Reservas | 1 | `roomId` en `bookings`. |
| Empresa - Reservas | 1 | `companyId` en `bookings`. |
| Reserva - Pagos | 1 potencial | `bookingId` en `payments`. |

## 4. Almacenamiento de archivos

Las imágenes y los archivos binarios se almacenan en Firebase Storage. Firestore conserva sus URL y rutas de almacenamiento.

Estructura de rutas (todo cuelga de la carpeta de la empresa):

```text
companies/{companyId}/buildings/{buildingId}/photos/{uuid}.{ext}
companies/{companyId}/floors/{floorId}/plan.{ext}
companies/{companyId}/rooms/{roomId}/photos/{uuid}.{ext}
```

**Reglas** (`storage.rules`):

- Lectura pública de fotos y planos solo por ruta (`allow get`): no se pueden listar carpetas.
- Solo escribe (crear, actualizar y borrar) un usuario con `role == 'COMPANY'`, el mismo `companyId` en su token que el de la carpeta y el claim `companyApproved == true`. Nadie más escribe; lo que no está bajo `companies/` queda denegado.
- Solo imágenes PNG, JPEG, WebP o GIF (nada de SVG) de entre 1 byte y 5 MB.
- `companyApproved` lo fija la API: `false` al registrar la empresa, `true` al aprobarla o reactivarla y `false` (más revocación de tokens) al rechazarla o suspenderla. Tras aprobar, el front debe refrescar el token (`getIdToken(true)`) para poder subir. Las empresas ya aprobadas antes de este cambio necesitan que el admin las suspenda y reactive o ejecutar `npm run sync-company-claims -w server` (idempotente: pone `companyApproved: true` al dueño de cada empresa `APPROVED` y `false` al resto). El seed sí crea sus usuarios demo en Auth y les fija el claim (ver «Cuentas de demo»).
- La API refuerza esto: `fotos` (edificio y sala) y `mapImageUrl` (guardar mapa) solo aceptan URLs de descarga de ese bucket dentro de `companies/{companyId}/` de la empresa del token.

**Variable de entorno:** `FIREBASE_STORAGE_BUCKET` en el `.env` de `server/` (y en Vercel), con el mismo valor que `VITE_FIREBASE_STORAGE_BUCKET` del front (`<proyecto>.firebasestorage.app` o `<proyecto>.appspot.com`). Sin ella, la API rechaza cualquier URL de foto o plano con `400`.

**Desplegar las reglas** (hace falta Storage activado en la consola de Firebase):

```bash
npx firebase-tools deploy --only storage
```

**Probarlas a mano** (desde el front con una empresa aprobada, o con el SDK o la API REST de Storage usando su ID token):

1. Empresa propia: sube una imagen pequeña (PNG o JPG) a `companies/{su companyId}/rooms/{roomId}/photos/prueba.png`. Debe funcionar.
2. Empresa ajena: con ese mismo usuario, sube a `companies/{otro companyId}/…`. Debe fallar con `403 storage/unauthorized`.
3. Archivo no imagen o grande: sube un PDF o una imagen de más de 5 MB a la carpeta propia. Debe fallar con `403 storage/unauthorized`.
4. SVG: sube un `.svg` (`image/svg+xml`) a la carpeta propia. Debe fallar con `403 storage/unauthorized`.
5. Listado: con `listAll` del SDK sobre `companies/{companyId}/`, o con la API REST `GET .../o?prefix=companies/`, debe fallar con `403`.
6. Empresa sin aprobar (token sin `companyApproved`, o recién aprobada sin refrescar el token): la subida falla; tras `getIdToken(true)` funciona.
7. Sin sesión o con un cliente (`CLIENT`): cualquier subida falla; abrir en el navegador la URL de la imagen del paso 1 sí funciona (lectura pública).

Nota para el front: `uploadService` debe subir a estas rutas y enviar a la API la URL de descarga (`getDownloadURL`) tal cual.

## 5. Seguridad y reglas de acceso

Las reglas de Firestore deben garantizar que cada usuario solo pueda acceder a los datos que le corresponden.

| Recurso | Permisos |
| --- | --- |
| `users` | Cada usuario puede consultar y modificar su perfil, sin poder cambiar su propio rol. |
| `companies` | Los miembros autorizados pueden gestionar su empresa. |
| `buildings` | Los edificios publicados son de lectura pública; su gestión corresponde a la empresa propietaria. |
| `floors` | Las plantas publicadas son de lectura pública; su edición corresponde a la empresa propietaria. |
| `rooms` | Las salas publicadas son de lectura pública; su gestión corresponde a la empresa propietaria. |
| `blocks` | Solo los miembros autorizados de la empresa pueden crear, consultar, modificar o eliminar bloqueos. |
| `bookings` | Cada cliente consulta sus reservas; las empresas consultan las reservas de sus espacios. |
| `payments` | Acceso restringido; las operaciones se gestionan desde el servidor. |

Las operaciones críticas, como confirmar reservas, verificar pagos, gestionar reembolsos y modificar roles, se ejecutan exclusivamente desde funciones del servidor mediante Firebase Admin SDK.

## 6. Cálculo de disponibilidad y prevención de solapamientos

No se almacenan todos los horarios libres como documentos. La disponibilidad de una sala se calcula cuando un usuario consulta una fecha y una franja horaria.

Para determinar si una sala puede reservarse, el servidor consulta:

1. El horario reservable, de 8 a 20.
2. Las reservas existentes en `bookings`, teniendo en cuenta las reservas confirmadas (y, con el extra de Stripe, las provisionales que todavía no han caducado).
3. Los bloqueos manuales almacenados en la colección `blocks`.

A partir de esos datos, el servidor determina qué intervalos están libres y puede ofrecerlos al cliente.

**Prevención de solapamientos:**

Firestore no impide automáticamente que dos documentos representen reservas con horarios incompatibles. Por ello, antes de confirmar una reserva, el servidor debe:

1. Comprobar que la sala está publicada.
2. Consultar las reservas y bloqueos que coincidan con el intervalo solicitado.
3. Comprobar que no existe ningún solapamiento.
4. Crear la reserva `CONFIRMED` y sus fichas de `occupancy` en una transacción. Si otra reserva ya ha cogido alguna de esas horas, responde `409 SLOT_TAKEN`.

Con el extra de Stripe, la reserva se crea como provisional (`PENDING_PAYMENT`), se confirma cuando Stripe notifica que el pago se ha completado y se libera el horario si el pago falla o la reserva caduca.

Estas operaciones deben diseñarse para evitar condiciones de carrera cuando varios clientes intentan reservar simultáneamente.

## 7. Índices y consultas previstas

Será necesario definir índices compuestos en Firestore para las consultas más habituales, entre ellas:

- Edificios publicados por ciudad.
- Salas publicadas por edificio y planta.
- Salas filtradas por capacidad y precio.
- Reservas de un usuario ordenadas por fecha.
- Reservas de una empresa filtradas por estado y fecha.
- Reservas de una sala para comprobar solapamientos.
- Bloqueos de una sala para comprobar los intervalos no reservables.

Los índices definitivos se añadirán conforme se implementen las consultas de la aplicación.

## 8. Decisiones pendientes

Algunos aspectos del modelo deberán concretarse durante el desarrollo:

- Estructura exacta de `openingHours`.
- Gestión de los bloqueos temporales durante el pago.
- Política de cancelaciones y reembolsos.
- Duración máxima de una reserva provisional.
- Tratamiento de los cambios de precio de las salas.
- Necesidad de conservar un historial de operaciones y cambios de estado.

Este diseño constituye una propuesta inicial y podrá evolucionar según las necesidades reales de implementación.

## 9. Idioma de la API

- **Body y respuestas de la API, en español** (`nombre`, `precioHora`, `fecha`, `inicio`, `fin`, `estado`), que es lo que usan el front y los textos de la interfaz.
- **Campos de Firestore, en inglés** (`name`, `price`, `startDate`, `endDate`, `status`), como en las tablas de arriba.
- Los ids se llaman igual en los dos lados (`roomId`, `floorId`, `buildingId`) y los valores de estado de Firestore (`CONFIRMED`, `FREE`…) no se traducen salvo que se indique.
- Los services hacen la traducción con una lista blanca de campos: lo que no está en la tabla se ignora.

Equivalencias por recurso (campo de la API → campo de Firestore):

| Recurso | API (español) | Firestore (inglés) |
| --- | --- | --- |
| Empresa (registro) | `nombreEmpresa` | `companies.name` |
| Empresa (registro) | `cif` | `companies.taxId` |
| Empresa (registro) | `contacto` | `companies.contactName` |
| Empresa (registro) | `telefono` | `companies.phone` |
| Empresa (registro) | `email` | `companies.email` (y el email de acceso) |
| Empresa (registro) | `nombre` (del usuario) | `users.name` |
| Empresa | `estado` (`pendiente`, `aprobada`, `rechazada`, `suspendida`) | `companies.status` (`PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`) |
| Edificio | `nombre` | `name` |
| Edificio | `direccion` | `address` |
| Edificio | `ciudad` | `city` |
| Edificio | `descripcion` | `description` |
| Edificio | `fotos` | `photos` |
| Edificio | `codigoPostal` | `postalCode` |
| Edificio | `pais` | `country` |
| Edificio | `latitud` | `latitude` |
| Edificio | `longitud` | `longitude` |
| Edificio | `numPlantas` | `floorCount` |
| Edificio | `publicado` | `status === 'PUBLISHED'` |
| Planta | `numero` (panel de empresa) o `nivel` (API pública) | `level` |
| Planta | `nombre` | `name` |
| Planta | `publicado` | `status === 'PUBLISHED'` |
| Planta | `buildingId` (panel de empresa) o `edificioId` (API pública) | `buildingId` |
| Planta | `ancho`, `alto`, `origen`, `salas` | Iguales: `ancho`, `alto`, `origen`, `salas` |
| Sala | `codigo` | `code` |
| Sala | `nombre` | `name` |
| Sala | `tipo` | `type` |
| Sala | `descripcion` | `description` |
| Sala | `capacidad` | `capacity` |
| Sala | `m2` | `surface` |
| Sala | `precioHora` | `price` |
| Sala | `periodoPrecio` | `pricePeriod` |
| Sala | `equipamiento` | `amenities` |
| Sala | `reservable` | `bookable` |
| Sala | `fotos` | `photos` |
| Sala | `estado` en el plano público (`FREE`, `OCCUPIED`, `UNAVAILABLE`) | Calculado en cada consulta; no se guarda |
| Sala | `estado` en el panel de empresa (`publicada`, `sin_precio`, `oculta`) | Calculado; disponible tras fusionar #170 (DAT018) |
| Reserva | `roomId` | `roomId` |
| Reserva | `fecha` + `inicio` | `startDate` |
| Reserva | `fecha` + `fin` | `endDate` |
| Reserva | `precioHora` | `price` |
| Reserva | `importe` | `totalAmount` |
| Reserva | `estado` (`CONFIRMED`, `CANCELLED`…, sin traducir) | `status` |
| Reserva | `horas` | Calculado (`fin - inicio`); no se guarda |

**Excepción conocida:** `GET /api/companies/me` todavía responde en inglés (`name`, `taxId`, `contactName`, `phone`, `email`, `createdAt`; solo `estado` va en español). Está pendiente de traducir en una issue de código.

Publicar y despublicar un edificio (`publicado`, que cambia `status` entre `DRAFT` y `PUBLISHED`) y los filtros de `GET /api/company/rooms` estarán disponibles tras fusionar #170 (DAT018).

# Convenciones de trabajo

Cómo nombramos ramas y commits, cómo abrimos Pull Requests y cómo mantenemos el mismo estilo de código entre los cuatro.

## Ramas

- `main` está protegida y siempre debe poder desplegarse: nadie hace push directo, todo entra por Pull Request.
- Una rama por issue, creada desde la propia issue en GitHub (*Development → Create a branch*), saliendo de `main` actualizada.
- El nombre es el código de la issue seguido de su título en minúsculas y con guiones. Es el que propone GitHub al crearla desde la issue:

```text
CÓDIGO-titulo-de-la-issue
```

| Ejemplo de rama | Issue |
| --- | --- |
| `DEF002-definir-usuarios-objetivo-e-historias` | Definición del proyecto |
| `DIS002-wireframes-de-baja-fidelidad-de` | Diseño |
| `SET003-eslint-prettier-y-convencion-de` | Configuración del proyecto |
| `DAT001-disenar-el-modelo-de-datos` | Datos |

## Commits

- Formato: **`CÓDIGO: descripción`**, con el código de la issue de la rama y una descripción corta en español de lo que cambia.
- Un commit, un propósito. Mover o renombrar archivos va en un commit aparte, nunca mezclado con cambios de lógica.
- Antes de cada commit, `npm run lint` sin errores.

```text
SET003: configura ESLint y Prettier
SET003: añade la convención de ramas y commits al README
DAT001: diseño de datos, colecciones y relaciones
```

## Pull Requests

- Título: el de la issue, por ejemplo `SET003 · ESLint, Prettier y convención de ramas y commits en el README`.
- En la descripción, `Closes #N` con el número de la issue, para que se cierre sola al fusionar.
- La revisa y la aprueba otra persona del equipo antes de fusionarla con `main`.
- Lo que sobra no se borra por cuenta propia: se mueve a `_to_delete/` y se avisa al equipo.

## Variables de entorno de la API (Firebase Admin)

La API se conecta a Firestore y a Firebase Auth con `firebase-admin`, usando la clave de una **cuenta de servicio**. Esa clave da acceso total al proyecto: nunca se sube a Git ni se pega en el código.

1. En la [Consola de Firebase](https://console.firebase.google.com/), abre el proyecto → ⚙️ **Configuración del proyecto** → pestaña **Cuentas de servicio**.
2. Pulsa **Generar nueva clave privada**. Se descarga un JSON (`…-firebase-adminsdk-….json`). Guárdalo fuera del repo; el `.gitignore` lo ignora por si acaso.
3. Copia `server/.env.example` a `server/.env` y rellena con los datos del JSON:

| Variable | Campo del JSON |
| --- | --- |
| `FIREBASE_PROJECT_ID` | `project_id` |
| `FIREBASE_CLIENT_EMAIL` | `client_email` |
| `FIREBASE_PRIVATE_KEY` | `private_key`, entre comillas dobles y con los `\n` tal cual |
| `FIREBASE_STORAGE_BUCKET` | Bucket de Storage (no está en el JSON; es el de `VITE_FIREBASE_STORAGE_BUCKET`) |
| `APP_URL` | URL de la web (p. ej. `https://ipuente.vercel.app`, sin barra final): es el único origen que permite CORS (los Preview Deployments de Vercel tienen otra URL y no lo pasan).  En desarrollo, si falta, se usa `http://localhost:5173`; en producción no hay valor por defecto. |

4. Comprueba la conexión (escribe, lee y borra un documento en `_ping`):

```bash
cd server
node --env-file=.env scripts/pingDb.js
```

En **Vercel**, las mismas variables van en *Settings → Environment Variables*. `config.js` convierte los `\n` literales de la clave en saltos de línea reales.

**Límites y proxy:** la API limita las peticiones por IP (general 300 cada 15 min, registro 10 por hora, detección con IA 10 por hora) y responde `429 RATE_LIMITED`. Como en Vercel hay un proxy delante, `app.js` usa `trust proxy = 1` para leer la IP real del cliente; si se despliega sin proxy, hay que quitarlo o cualquiera podría falsear su IP con `X-Forwarded-For`. El límite general cuenta en la memoria de cada instancia (orientativo, para no escribir en Firestore en cada petición); el de registro y el de IA usan un contador compartido en Firestore (colección `rateLimits`, documento por clave con `count` y `expiresAt`). Conviene activar en Firebase la política TTL de Firestore sobre `rateLimits.expiresAt` para que los contadores caducados se borren solos.

**IP real en Vercel:** el límite usa la cabecera `x-vercel-forwarded-for` (Vercel la sobrescribe en cada petición, así que el cliente no puede falsearla; si trae varias IP, se usa la primera); si no existe (local, tests), `req.ip`. No se usa `x-real-ip` ni `x-forwarded-for` directamente. `trust proxy` sigue en 1.

**Orden de middlewares en `app.js`:** cors → (hueco para el webhook de Stripe, sin parsear y fuera del límite) → límite general en `/api` → `express.json()` → `/api/docs` → rutas. `/api/docs` queda dentro del límite general.

**Fallar cerrado:** los límites solo se saltan con `NODE_ENV=test` exacto (lo fija `server/tests/setup.js` en `npm test`); con cualquier otro valor, también en producción, están activos, y nunca se saltan si existe `VERCEL_ENV`. Si Firestore falla, el registro deja pasar (sin Firestore tampoco puede registrar) y la detección con IA responde `503 RATE_LIMIT_UNAVAILABLE`, porque cuesta dinero.

**CIF huérfano:** `companyTaxIds/<cif>` se reserva en una transacción; si el documento no tiene `companyId` y tiene más de 10 minutos, o su `companyId` apunta a una empresa que no existe, se sobrescribe. Rechazar o suspender una empresa NO libera su CIF.

## Desarrollo en local

Se necesitan dos terminales desde la raíz del repositorio:

```bash
npm run dev -w server   # la API en http://localhost:3000 (necesita server/.env)
npm run dev             # la web en http://localhost:5173; Vite redirige /api a la API
```

Comprueba que la API es la tuya: `http://localhost:3000/api/health` debe responder `{ "ok": true }`.

**Si el puerto 3000 lo usa otra aplicación** (por ejemplo un softphone o un servidor de otro proyecto), todo `/api/...` responde `404` en HTML y la web lo nota así: «Mis reservas» muestra «No se ha podido contactar con el servidor» y el resto de pantallas enseñan datos de ejemplo con el aviso «la API no está disponible». Arranca la API en otro puerto y dile a Vite dónde está:

```bash
# en server/.env:  PORT=3001
API_PROXY_TARGET=http://localhost:3001 npm run dev
```

En desarrollo, un error de la API sin el JSON esperado deja un aviso en la consola del navegador (`[api] … HTTP 404 sin JSON de error`).

## Despliegue en Vercel

La web (`client/`) y la API (Express como función de Vercel, `api/index.js`) se despliegan juntas desde `vercel.json`. Requiere Node 22 (`.nvmrc`; `engines` pide `22.x`, así Vercel usa la última 22.x, que admite `require()` de módulos ESM como pide `jwks-rsa` en `firebase-admin`).

`vercel.json` no admite comentarios, así que se explica aquí: `installCommand` es `npm ci --include=dev` para que el build tenga Vite (devDependency) aunque `NODE_ENV=production`; `outputDirectory` es `client/dist`; `regions` es `fra1` (Fráncfort, cerca de España); la función `api/index.js` tiene `maxDuration` de 60 s e `includeFiles` copia `server/src/routes/**` porque Swagger lee los `@openapi` en ejecución; los `rewrites` mandan `/api/*` a la función (Vercel conserva la URL original) y el resto a `index.html` (React Router). Los archivos estáticos se sirven antes que los rewrites. `.vercelignore` deja fuera del despliegue lo que no hace falta y puede ser sensible (variables de entorno, claves de cuentas de servicio, `docs/`, `_to_delete/`, `.claude/`, tests y scripts del servidor).

1. En Vercel: **Add New → Project**, importa el repositorio de GitHub y la rama `main`. **Root Directory = la raíz del repositorio** (no `client`); Vercel lee `vercel.json` (si no lo detecta, *Framework Preset = Other*). Si el repositorio es de una organización, un owner debe aprobar la app de Vercel en GitHub. Alternativa sin GitHub: `npx vercel link` y `npx vercel` (vista previa) o `npx vercel --prod` desde la raíz.
2. En *Settings → Environment Variables* crea, para **Production** y también para **Preview** (en Vercel cualquier entorno cuenta como producción: sin `FIREBASE_*` y `APP_URL` la API no arranca ni en Preview):
   - Del front (las lee Vite al construir; no son secretas): `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID` y `VITE_FIREBASE_APP_ID`.
   - De la API (se leen en ejecución): `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (solo como variable de servidor, nunca con prefijo `VITE_`; márcala como **Sensitive**; pega el valor sin comillas y con los `
` literales), `FIREBASE_STORAGE_BUCKET` y `APP_URL` (obligatoria en producción: la URL pública, p. ej. `https://<proyecto>.vercel.app`, sin barra final).
   - `NODE_ENV`: no hace falta definirlo, Vercel ya lo pone en `production` en el build y en las funciones. Aunque lo cambies, la API se trata como producción mientras exista `VERCEL_ENV` (exige `FIREBASE_*` y `APP_URL`, sin `localhost` por defecto, y los límites de peticiones nunca se saltan). Si lo defines, no pasa nada: `npm ci --include=dev` evita que se omitan las dependencias de desarrollo.
   - **Nunca** pongas secretos con prefijo `VITE_`: todo lo que lleva `VITE_` acaba dentro del JavaScript público de la web.
   - **CORS:** solo admite el `APP_URL` de producción; los Preview Deployments (otra URL) no podrán llamar a la API desde el navegador.
3. En Firebase, **antes de publicar** (si faltan los índices, `GET /api/company/summary` responde 500): `npx firebase-tools deploy --only firestore,storage` (reglas e índices; espera a que los índices pasen a *Enabled*); añade el dominio `*.vercel.app` del proyecto en *Authentication → Settings → Authorized domains*; activa la política TTL de Firestore sobre `rateLimits.expiresAt`.
4. Si ya había empresas aprobadas antes del claim `companyApproved`: `npm run sync-company-claims -w server`. Para cargar datos de demo: `npm run seed -w server`.
5. Despliega y comprueba `/api/health` (debe responder `{ "ok": true }`) y `/api/docs` (Swagger). La zona horaria de la API se fija en `Europe/Madrid` (`server/src/config/timezone.js`).

El CI de GitHub Actions (`.github/workflows/ci.yml`) ejecuta lint, tests y build en cada Pull Request.

## Cuentas de demo

El seed crea usuarios en Firebase Auth (con su rol, sus claims, la marca `demo` y su ficha en `users`) y los datos de ejemplo. Como solo hay un proyecto de Firebase, está protegido:

- Se niega a ejecutarse con `NODE_ENV=production`.
- Exige `--yes`. Sin él imprime el `FIREBASE_PROJECT_ID` de destino y lo que haría, y sale sin escribir.
- El admin demo solo se crea con `--admin`; sin esa opción no se toca. Tu admin propio nunca se modifica.
- Un usuario que ya existía en Auth y no tiene la marca `demo` no se toca (ni sus claims ni su ficha): el admin se salta con un aviso y, si es el cliente o un dueño de empresa, el seed aborta antes de escribir datos.
- `SEED_DEMO_PASSWORD` (mínimo 12 caracteres) es la contraseña de las cuentas nuevas; no cambia la de las que ya existen y no se guarda en el repositorio.

En Git Bash (la contraseña va entre comillas simples y solo para ese comando):

```bash
SEED_DEMO_PASSWORD='una-clave-larga-y-unica' npm run seed -w server -- --yes
# con el admin demo:
SEED_DEMO_PASSWORD='una-clave-larga-y-unica' npm run seed -w server -- --yes --admin
```

| Email | Rol | Qué es |
| --- | --- | --- |
| `admin.demo@ipuente.test` | `ADMIN` | Panel de administración (solo con `--admin`) |
| `cliente.demo@ipuente.test` | `CLIENT` | Dueño de las reservas de ejemplo (confirmadas y canceladas) |
| `empresa.demo@ipuente.test` | `COMPANY` | Dueño de la empresa aprobada «Espacios Demo Sevilla» (edificio, plantas, salas y un bloqueo) |
| `pendiente.demo@ipuente.test` | `COMPANY` | Dueño de una empresa pendiente de aprobación, sin edificios |

## ESLint y Prettier

**ESLint** busca errores en el código y **Prettier** le da formato. No se pisan: `eslint-config-prettier` apaga en ESLint las reglas de formato.

| Comando (desde la raíz) | Qué hace |
| --- | --- |
| `npm install` | Instala las dependencias de `client/` y `server/` (npm workspaces) |
| `npm run lint` | Pasa ESLint por `client/` y `server/` |
| `npm run lint:fix` | Igual, y arregla lo que se pueda arreglar solo |
| `npm run format` | Formatea todo el proyecto con Prettier |
| `npm run format:check` | Comprueba el formato sin tocar nada |

- **ESLint** tiene una configuración por parte:
  - `client/eslint.config.js`: reglas recomendadas de JavaScript, reglas de los hooks de React (`react-hooks`) y de Vite (`react-refresh`), con las globales del navegador.
  - `server/eslint.config.js`: reglas recomendadas de JavaScript con las globales de Node. Avisa de los `console.log` olvidados (`console.warn` y `console.error` sí se permiten).
- **Prettier** (`.prettierrc`): comillas simples, punto y coma, 100 caracteres por línea, 2 espacios y coma final en listas y objetos. `.prettierignore` deja fuera `node_modules`, `dist`, `package-lock.json` y `_to_delete`.
- **`.editorconfig`**: UTF-8, 2 espacios y saltos de línea LF en cualquier editor.
- En VS Code, recomendamos instalar las extensiones *ESLint* y *Prettier* y activar *Format on Save*.

# Prototipo navegable del flujo principal

### Enlace
https://www.figma.com/proto/f9p2T0dQ9D4Zf3NGX7JfPa/iPuente-%C2%B7-Wireframes--Copia-?node-id=4-117&p=f&t=jab2ZhUeT4QE1r82-1&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=4%3A117&show-proto-sidebar=1

# Guía de estilo

Dirección visual **Bosque**: fondo verde bosque, texto crema, lima solo para lo activo, el edificio en verde claro (`--libre`) y bronce para los pines y los números de paso. Tipografía Newsreader (titulares) y Hanken Grotesk (cuerpo e interfaz).

### Enlace
https://www.figma.com/design/Q7e0bEAnLUI7IKLrxwLaYp

El archivo de Figma recoge el logo, la paleta (22 variables de color y 6 de forma), los estados de sala, 9 estilos de texto, los contrastes y las reglas de uso. La versión en texto, con las variables CSS listas para `client/styles/style.css`, está en [`docs/diseno/fundamentos.md`](./docs/diseno/fundamentos.md). El logo y los iconos web están en `docs/images/`.