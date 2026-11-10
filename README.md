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
# iPuente
 
iPuente es un portal donde las empresas publican sus oficinas y salas, y los clientes las alquilan por horas: eligen el edificio, la planta en un modelo 3D y la sala en su plano, y ven su precio, capacidad y equipamiento antes de reservar. Cada empresa sube la imagen de su plano, iPuente detecta las salas automáticamente y genera el mapa interactivo y el edificio 3D, que la empresa revisa y publica desde su propio panel.

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
