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
- [Cómo se guarda un mapa](#cómo-se-guarda-un-mapa)

  
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
- **Tiempo real.** Firestore avisa de los cambios al momento, así que el plano se actualiza en cuanto alguien reserva una sala, sin recargar la página.
- **Seguridad por rol en la propia base de datos.** Con las reglas de Firestore, los edificios y planos publicados son de lectura pública, cada empresa solo puede ver lo suyo, y reservas, pagos y roles solo se escriben desde nuestras funciones del servidor.
- **Sin servidor que mantener.** El plan gratuito cubre el proyecto, y Firebase se integra con Netlify Functions mediante `firebase-admin` para la lógica protegida: reservas, pagos con Stripe y análisis de planos con IA, cuyas claves nunca llegan al navegador.
**Frente a Supabase (PostgreSQL):** Supabase sería mejor opción con un modelo muy relacional o con informes complejos en SQL. Para un proyecto de pocas semanas y un modelo sencillo, Firebase nos da autenticación, base de datos y tiempo real con menos configuración.
 
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
