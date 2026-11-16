// Datos de la «Planta 2» de la Landing. Posiciones y tamaños en píxeles del plano del prototipo (560 x 360).
// Todo lo marcado con // ejemplo es dato de muestra, no viene de la API.

export const STATUS_LABELS = {
  free: 'Libre',
  occupied: 'Ocupada',
  off: 'No se alquila',
};

// Cámara fija inclinada como el prototipo (rotateX 56deg: 34 grados sobre el horizonte; rotateZ -32deg: giro de 32 grados).
const ELEVACION = (34 * Math.PI) / 180;
const GIRO = (32 * Math.PI) / 180;
const DISTANCIA = 11;
export const FLOOR_CAMERA = {
  fov: 30,
  position: [
    DISTANCIA * Math.cos(ELEVACION) * Math.sin(GIRO),
    DISTANCIA * Math.sin(ELEVACION),
    DISTANCIA * Math.cos(ELEVACION) * Math.cos(GIRO),
  ],
};

export const FLOOR_PLAN = {
  name: 'Planta 2',
  width: 560,
  height: 360,
  // Pasillo entre las dos filas de salas.
  corridor: { y: 140, height: 32 },
  rooms: [
    {
      id: '2.01',
      name: 'Sala 2.01',
      status: 'free',
      x: 0,
      y: 0,
      w: 170,
      h: 140,
      people: 6, // ejemplo
      area: 18, // ejemplo
      price: 12, // ejemplo
      equipment: ['pantalla', 'pizarra', 'wifi'], // ejemplo
    },
    {
      id: '2.02',
      name: 'Sala 2.02',
      status: 'occupied',
      x: 178,
      y: 0,
      w: 222,
      h: 140,
      people: 10, // ejemplo
      area: 26, // ejemplo
      price: 18, // ejemplo
      equipment: ['pantalla', 'videoconferencia', 'wifi'], // ejemplo
    },
    {
      id: '2.03',
      name: 'Sala 2.03',
      status: 'free',
      x: 408,
      y: 0,
      w: 152,
      h: 140,
      people: 4, // ejemplo
      area: 14, // ejemplo
      price: 9, // ejemplo
      equipment: ['pizarra', 'wifi'], // ejemplo
    },
    {
      id: '2.04',
      name: 'Sala 2.04',
      status: 'off',
      x: 0,
      y: 172,
      w: 240,
      h: 188,
      people: 12, // ejemplo
      area: 32, // ejemplo
      price: 0, // ejemplo
      equipment: [], // ejemplo
    },
    {
      id: '2.05',
      name: 'Sala 2.05',
      status: 'free',
      x: 248,
      y: 172,
      w: 164,
      h: 188,
      people: 8, // ejemplo
      area: 22, // ejemplo
      price: 15, // ejemplo
      equipment: ['pantalla', 'pizarra', 'wifi'], // ejemplo
    },
    {
      id: '2.06',
      name: 'Sala 2.06',
      status: 'occupied',
      x: 420,
      y: 172,
      w: 140,
      h: 188,
      people: 5, // ejemplo
      area: 16, // ejemplo
      price: 10, // ejemplo
      equipment: ['pizarra', 'wifi'], // ejemplo
    },
  ],
};
