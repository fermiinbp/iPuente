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
