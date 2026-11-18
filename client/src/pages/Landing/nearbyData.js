// Datos de la sección «Alrededor del edificio». Todo es un ejemplo hasta tener edificios reales.
// Las posiciones están en unidades del mapa 3D: x hacia la derecha, z hacia el espectador; el edificio está en [0, 0].

export const NEARBY_BUILDING = {
  name: 'Edificio Puerta Sur', // ejemplo
  size: [2.2, 1.3, 1.6], // ancho, alto y fondo del volumen
};

export const NEARBY_PLACES = [
  {
    id: 'metro',
    name: 'Metro más cercano',
    time: '4 min a pie', // ejemplo
    shortTime: '4 min',
    position: [-3.1, -2.2],
    detail:
      'Parada de la línea 1 a la vuelta de la esquina, con salida directa a la calle del edificio.', // ejemplo
  },
  {
    id: 'tren',
    name: 'Estación de tren',
    time: '9 min', // ejemplo
    shortTime: '9 min',
    position: [3.7, -2.2],
    detail: 'Trenes de cercanías y larga distancia. Se llega en autobús o en un paseo rápido.', // ejemplo
  },
  {
    id: 'aparcamiento',
    name: 'Aparcamiento',
    time: '3 min a pie', // ejemplo
    shortTime: '3 min',
    position: [-2.7, 2.2],
    detail: 'Aparcamiento público cubierto con plazas para tus invitados, abierto las 24 horas.', // ejemplo
  },
  {
    id: 'aeropuerto',
    name: 'Aeropuerto',
    time: '25 min en coche', // ejemplo
    shortTime: '25 min',
    position: [4.7, 3.2],
    detail: 'A media hora de los vuelos nacionales e internacionales, con taxi y autobús directo.', // ejemplo
  },
];
