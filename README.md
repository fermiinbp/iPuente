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

  
## Problema que resuelve
 
**Para los clientes:** hoy, quien quiere alquilar una sala para una charla, una reunión o un evento lo hace a ciegas. No sabe cómo es el espacio, si cabe su gente, qué equipamiento tiene ni si está libre, y muchas veces tiene que ir en persona o escribir para preguntarlo.
 
**Para las empresas que alquilan espacios:** mostrar sus oficinas de forma visual exige fotos, planos y una web propia, y las reservas se gestionan a mano por correo o teléfono, con solapes y huecos perdidos.
 
iPuente une las dos partes en un mismo sitio. La empresa convierte su plano en un mapa interactivo en minutos, sin dibujar desde cero. El cliente ve el edificio, el plano de cada planta y la disponibilidad real de cada sala, y reserva y paga sin intermediarios.
 
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
4. Reserva por fecha y franja horaria, y paga online.



## Por qué Firebase
 
- **Autenticación resuelta y segura.** Firebase Auth gestiona el registro con email y con Google, la recuperación de contraseña y los tokens de sesión. Las contraseñas nunca pasan por nuestro código ni por nuestra base de datos, así que reducimos el riesgo de una brecha de seguridad.
- **NoSQL encaja con el modelo.** Tenemos pocas entidades (usuarios, empresas, edificios, plantas, salas, reservas y pagos), relacionadas de forma simple por id. Además, el mapa de cada planta es un documento JSON con la lista de salas y sus posiciones: se guarda y se lee de una vez, que es justo como lo usan el editor, el plano y el modelo 3D.
- **Disponibilidad siempre al día.** El servidor calcula los huecos libres de cada sala en el momento de consultarla, a partir de su horario, sus reservas y sus bloqueos, así que el plano muestra siempre la ocupación real sin guardar los horarios libres por separado.
- **Archivos en el mismo sitio.** Firebase Storage guarda los planos y las fotos de las salas, y Firestore solo conserva su URL y su ruta.
- **Seguridad por rol en la propia base de datos.** Con las reglas de Firestore, los edificios y planos publicados son de lectura pública, cada empresa solo puede ver lo suyo, y reservas, pagos y roles solo se escriben desde nuestras funciones del servidor.
- **Sin servidor que mantener.** El plan gratuito cubre el proyecto, y Firebase se integra con Netlify Functions mediante `firebase-admin` para la lógica protegida: reservas, pagos con Stripe y análisis de planos con IA, cuyas claves nunca llegan al navegador.
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
| Cliente | Persona o empresa que alquila | Reservar y pagar, ver y cancelar sus reservas, editar su perfil, guardar salas favoritas. |
| Empresa | Propietaria o gestora de un espacio | Dar de alta edificios y plantas, subir planos, usar el editor de mapas, gestionar sus salas y ver las reservas de sus espacios. Solo ve y modifica lo suyo. |
| Admin | Equipo de iPuente | Aprobar o suspender empresas, gestionar usuarios y roles, ver todas las reservas y pagos, hacer reembolsos. |
 
Nadie puede registrarse como admin, y las cuentas de empresa quedan pendientes hasta que un admin las aprueba.
 
## Historias de usuario
 
| ID | Historia |
| --- | --- |
| HU-01 | Como **visitante**, quiero explorar un edificio en 3D y elegir una planta, para hacerme una idea del espacio sin ir en persona. |
| HU-02 | Como **visitante**, quiero ver en el plano de cada planta qué salas están libres en una fecha, para saber rápido qué opciones tengo. |
| HU-03 | Como **visitante**, quiero ver el precio, la capacidad, los m² y el equipamiento de una sala, para saber si encaja con mi evento antes de registrarme. |
| HU-04 | Como **visitante**, quiero registrarme con mi email o mi cuenta de Google, para poder reservar sin rellenar formularios largos. |
| HU-05 | Como **cliente**, quiero reservar una sala por fecha y franja horaria y pagarla online, para cerrar el alquiler en un solo paso. |
| HU-06 | Como **cliente**, quiero ver y cancelar mis reservas, para gestionar cambios de planes sin llamar a nadie. |
| HU-07 | Como **empresa**, quiero registrarme y dar de alta mi edificio con sus plantas, para publicar mis espacios en el portal. |
| HU-08 | Como **empresa**, quiero subir la imagen de mi plano y que se detecten las salas automáticamente, para no tener que dibujar el mapa desde cero. |
| HU-09 | Como **empresa**, quiero corregir el mapa detectado o dibujar las salas a mano sobre mi plano, para que el mapa publicado sea exacto. |
| HU-10 | Como **empresa**, quiero indicar el precio, la capacidad, el equipamiento y las fotos de cada sala, para que los clientes tengan toda la información. |
| HU-11 | Como **empresa**, quiero ver las reservas de mis salas y bloquear horas, para controlar la ocupación de mis espacios. |
| HU-12 | Como **admin**, quiero aprobar o suspender empresas, para que solo se publiquen espacios reales. |
| HU-13 | Como **admin**, quiero ver todas las reservas y pagos y hacer reembolsos, para resolver incidencias. |
 
## Alcance del MVP
 
### Funcionalidades obligatorias (entran en el MVP)
 
| # | Funcionalidad | Historias |
| --- | --- | --- |
| 1 | Registro e inicio de sesión con email y Google; roles de cliente, empresa y admin | HU-04, HU-07 |
| 2 | Alta de empresa, edificio y plantas | HU-07 |
| 3 | Editor de mapas: plano subido como fondo y salas como rectángulos que se dibujan, mueven, redimensionan y nombran | HU-09 |
| 4 | Detección automática de salas a partir de la imagen del plano, con IA, como borrador editable | HU-08 |
| 5 | Guardar el mapa de cada planta en Firestore | HU-08, HU-09 |
| 6 | Datos de cada sala: precio por hora, capacidad, m², equipamiento y fotos | HU-10 |
| 7 | Plano 2D clicable para clientes, con colores según el estado de cada sala (libre, ocupada, no reservable) | HU-02 |
| 8 | Ficha de sala con huecos libres | HU-03 |
| 9 | Reserva por fecha y franja horaria, sin solapes | HU-05 |
| 10 | Pago online con Stripe en modo de prueba, a una cuenta única de la plataforma | HU-05 |
| 11 | «Mis reservas»: consultar y cancelar | HU-06 |
| 12 | Panel de empresa: sus salas, reservas y bloqueos | HU-11 |
| 13 | Panel de admin: aprobar empresas, usuarios, reservas, pagos y reembolsos | HU-12, HU-13 |
| 14 | Diseño responsive (móvil, tablet y escritorio) | Todas |
 
**Orden de desarrollo:** primero el editor manual (punto 3), que garantiza que siempre haya mapa; después la detección automática (punto 4), que rellena ese mismo editor. Si falta tiempo, la detección automática es lo primero que se recorta y el portal sigue funcionando.
 
### Extras (solo si el MVP está terminado, por orden de prioridad)
 
1. Edificio 3D generado a partir de las plantas guardadas (Three.js): plantas apiladas y cada sala como un bloque. Mientras no esté, la landing usa una imagen del edificio con zonas clicables por planta.
2. Buscador de edificios por ciudad, capacidad y equipamiento.
3. Filtro por necesidades que resalta en el plano las salas que encajan.
4. Selector de hora que actualiza la ocupación del plano.
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
| `offices` | Salas y espacios disponibles para alquilar. |
| `bookings` | Reservas realizadas por los clientes. |
| `payments` | Operaciones de pago asociadas a las reservas. |
| `favorites` | Salas guardadas como favoritas por los usuarios. |

Subcolecciones previstas:

- `companies/{companyId}/members`: usuarios que pertenecen a una empresa y sus permisos.
- `offices/{officeId}/blocks`: periodos bloqueados manualmente por la empresa.
- `offices/{officeId}/images`: imágenes asociadas a una sala.

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
| `taxId` | Identificador fiscal. |
| `description` | Descripción de la empresa. |
| `logoUrl` | URL del logotipo. |
| `email` | Correo de contacto. |
| `phone` | Teléfono de contacto. |
| `address` | Dirección de la empresa. |
| `verified` | Indica si la empresa ha sido aprobada por un administrador. |
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
| `status` | Estado del edificio. |
| `createdAt` | Fecha de creación. |
| `updatedAt` | Última actualización. |

### `floors`

Contiene la información de las plantas y los datos necesarios para representar sus mapas.

| Campo | Descripción |
| --- | --- |
| `buildingId` | Identificador del edificio al que pertenece. |
| `name` | Nombre o denominación de la planta. |
| `level` | Número o nivel de planta. |
| `mapImageUrl` | URL de la imagen original del plano. |
| `mapData` | Datos geométricos de las salas y sus posiciones. |
| `status` | Estado de la planta. |
| `createdAt` | Fecha de creación. |
| `updatedAt` | Última actualización. |

**Campo `mapData`:**

Se almacena como un objeto estructurado con la información necesaria para representar las salas sobre la imagen del plano.

Cada sala debe incluir, como mínimo:

- Identificador de la sala.
- Posición horizontal y vertical.
- Anchura y altura.
- Información necesaria para relacionarla con su documento en `offices`.

El formato definitivo se concretará durante el desarrollo del editor de mapas.

### `offices`

Almacena la información de cada sala o espacio que puede alquilarse.

| Campo | Descripción |
| --- | --- |
| `companyId` | Empresa propietaria o gestora. |
| `buildingId` | Edificio al que pertenece. |
| `floorId` | Planta en la que se encuentra. |
| `name` | Nombre de la sala. |
| `code` | Código identificativo de la sala. |
| `description` | Descripción del espacio. |
| `surface` | Superficie en metros cuadrados. |
| `capacity` | Capacidad máxima de personas. |
| `price` | Precio por hora. |
| `pricePeriod` | Periodo de facturación, inicialmente `HOUR`. |
| `amenities` | Equipamiento y servicios disponibles. |
| `status` | Estado de publicación de la sala. |
| `openingHours` | Horario habitual en el que se puede alquilar. |
| `createdAt` | Fecha de creación. |
| `updatedAt` | Última actualización. |

**Subcolección `blocks`**

Almacena los periodos en los que la empresa bloquea manualmente una sala. Por ejemplo, cuando necesita utilizarla para sus propias actividades o realizar tareas de mantenimiento.

| Campo | Descripción |
| --- | --- |
| `startDate` | Fecha y hora de inicio del bloqueo. |
| `endDate` | Fecha y hora de finalización. |
| `reason` | Motivo del bloqueo. |
| `createdAt` | Fecha de creación. |

Los bloqueos no representan reservas de clientes. Su única función es impedir que esos intervalos se puedan alquilar.

**Subcolección `images`**

Almacena las referencias a las imágenes de cada sala.

| Campo | Descripción |
| --- | --- |
| `url` | URL de la imagen en Firebase Storage. |
| `storagePath` | Ruta del archivo en Storage. |
| `order` | Orden de visualización. |
| `isCover` | Indica si es la imagen principal. |
| `createdAt` | Fecha de creación. |

### `bookings`

Almacena las reservas realizadas por los clientes.

| Campo | Descripción |
| --- | --- |
| `userId` | Cliente que realiza la reserva. |
| `companyId` | Empresa propietaria de la sala. |
| `officeId` | Sala reservada. |
| `startDate` | Fecha y hora de inicio. |
| `endDate` | Fecha y hora de finalización. |
| `price` | Precio aplicado por hora. |
| `pricePeriod` | Periodo de facturación: `HOUR`. |
| `totalAmount` | Importe total de la reserva. |
| `status` | Estado de la reserva. |
| `paymentId` | Identificador del pago asociado. |
| `createdAt` | Fecha de creación. |
| `updatedAt` | Última actualización. |

Estados posibles:

- `PENDING_PAYMENT`: pendiente de completar el pago.
- `CONFIRMED`: pago verificado y reserva confirmada.
- `CANCELLED`: reserva cancelada.
- `EXPIRED`: reserva provisional caducada.
- `COMPLETED`: alquiler finalizado.

### `payments`

Registra las operaciones de pago realizadas mediante Stripe.

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
| Planta - Salas | 1 | `floorId` en `offices`. |
| Sala - Bloqueos | 1 | Subcolección `blocks`. |
| Sala - Imágenes | 1 | Subcolección `images`. |
| Usuario - Reservas | 1 | `userId` en `bookings`. |
| Sala - Reservas | 1 | `officeId` en `bookings`. |
| Empresa - Reservas | 1 | `companyId` en `bookings`. |
| Reserva - Pagos | 1 potencial | `bookingId` en `payments`. |

## 4. Almacenamiento de archivos

Las imágenes y los archivos binarios se almacenan en Firebase Storage. Firestore conserva sus URL y rutas de almacenamiento.

Estructura orientativa:

```text
companies/
  {companyId}/
    logo.png

buildings/
  {buildingId}/
    floors/
      {floorId}/
        floor-plan.png

offices/
  {officeId}/
    images/
      image_01.jpg
      image_02.jpg
```

## 5. Seguridad y reglas de acceso

Las reglas de Firestore deben garantizar que cada usuario solo pueda acceder a los datos que le corresponden.

| Recurso | Permisos |
| --- | --- |
| `users` | Cada usuario puede consultar y modificar su perfil, sin poder cambiar su propio rol. |
| `companies` | Los miembros autorizados pueden gestionar su empresa. |
| `buildings` | Los edificios publicados son de lectura pública; su gestión corresponde a la empresa propietaria. |
| `floors` | Las plantas publicadas son de lectura pública; su edición corresponde a la empresa propietaria. |
| `offices` | Las salas publicadas son de lectura pública; su gestión corresponde a la empresa propietaria. |
| `blocks` | Solo los miembros autorizados de la empresa pueden crear, consultar, modificar o eliminar bloqueos. |
| `bookings` | Cada cliente consulta sus reservas; las empresas consultan las reservas de sus espacios. |
| `payments` | Acceso restringido; las operaciones se gestionan desde el servidor. |

Las operaciones críticas, como confirmar reservas, verificar pagos, gestionar reembolsos y modificar roles, se ejecutan exclusivamente desde funciones del servidor mediante Firebase Admin SDK.

## 6. Cálculo de disponibilidad y prevención de solapamientos

No se almacenan todos los horarios libres como documentos. La disponibilidad de una sala se calcula cuando un usuario consulta una fecha y una franja horaria.

Para determinar si una sala puede reservarse, el servidor consulta:

1. El horario habitual de apertura almacenado en `offices`.
2. Las reservas existentes en `bookings`, teniendo en cuenta las reservas confirmadas y las provisionales que todavía no han caducado.
3. Los bloqueos manuales almacenados en la subcolección `blocks`.

A partir de esos datos, el servidor determina qué intervalos están libres y puede ofrecerlos al cliente.

**Prevención de solapamientos:**

Firestore no impide automáticamente que dos documentos representen reservas con horarios incompatibles. Por ello, antes de confirmar una reserva, el servidor debe:

1. Comprobar que la sala está publicada.
2. Consultar las reservas y bloqueos que coincidan con el intervalo solicitado.
3. Comprobar que no existe ningún solapamiento.
4. Crear la reserva provisional y gestionar el bloqueo temporal del horario durante el pago.
5. Confirmar la reserva cuando Stripe notifique que el pago se ha completado correctamente.
6. Liberar el horario si el pago falla o la reserva provisional caduca.

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

- Formato definitivo de `mapData` y sistema de coordenadas del editor.
- Estructura exacta de `openingHours`.
- Gestión de los bloqueos temporales durante el pago.
- Política de cancelaciones y reembolsos.
- Duración máxima de una reserva provisional.
- Tratamiento de los cambios de precio de las salas.
- Necesidad de conservar un historial de operaciones y cambios de estado.

Este diseño constituye una propuesta inicial y podrá evolucionar según las necesidades reales de implementación.

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