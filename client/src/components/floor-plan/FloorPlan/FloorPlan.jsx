// Plano 3D de una planta: suelo, pasillo y salas como cajas bajas coloreadas por su estado.
// Se usa dentro de un <LazyCanvas>. Los materiales y geometrías se crean una vez; la sala elegida se eleva.
import { useEffect, useMemo } from 'react';
import {
  BoxGeometry,
  CanvasTexture,
  LineBasicMaterial,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { useThree } from '@react-three/fiber';
import { useCssColors } from '@/hooks/useCssColors.js';
import { useReducedMotion } from '@/hooks/useReducedMotion.js';
import RoomShape from '../RoomShape/RoomShape.jsx';

// 100 píxeles del prototipo equivalen a 1 unidad de la escena.
const ESCALA = 100;
const MARGEN = 0.14;
// Aspecto (ancho/alto) a partir del cual la escena cabe entera sin reducirla.
const ASPECTO_REFERENCIA = 1.3;
const ETIQUETAS = { free: 'Libre', occupied: 'Ocupada', off: 'No se alquila' };
const NOMBRES_COLOR = [
  'libre',
  'ocupada',
  'no-alquila',
  'trama-no-alquila',
  'bosque-elevado',
  'linea-plano',
  'lima',
];

function crearTrama(fondo, raya) {
  const lienzo = document.createElement('canvas');
  lienzo.width = 32;
  lienzo.height = 32;
  const cx = lienzo.getContext('2d');
  cx.fillStyle = fondo.getStyle();
  cx.fillRect(0, 0, 32, 32);
  cx.strokeStyle = raya.getStyle();
  cx.lineWidth = 3;
  for (let i = -32; i < 64; i += 8) {
    cx.beginPath();
    cx.moveTo(i, 32);
    cx.lineTo(i + 32, 0);
    cx.stroke();
  }
  const textura = new CanvasTexture(lienzo);
  textura.colorSpace = SRGBColorSpace;
  textura.wrapS = RepeatWrapping;
  textura.wrapT = RepeatWrapping;
  textura.repeat.set(2, 2);
  return textura;
}

export default function FloorPlan({ plan, selectedId, onSelect }) {
  const colores = useCssColors(NOMBRES_COLOR);
  const reducedMotion = useReducedMotion();

  // Encuadre: si el canvas es vertical o casi cuadrado, se reduce la escena (equivale a alejar la cámara).
  // `size` solo cambia al redimensionar, así que no hay renders por fotograma.
  const tamanoCanvas = useThree((estado) => estado.size);
  const aspecto = tamanoCanvas.width / Math.max(1, tamanoCanvas.height);
  const escalaEncuadre = Math.min(1, Math.max(0.55, aspecto / ASPECTO_REFERENCIA));

  const ancho = plan.width / ESCALA;
  const fondo = plan.height / ESCALA;

  const recursos = useMemo(() => {
    const trama = crearTrama(colores['no-alquila'], colores['trama-no-alquila']);
    const estandar = (color) =>
      new MeshStandardMaterial({ color, roughness: 0.8, toneMapped: false });
    return {
      trama,
      suelo: estandar(colores['bosque-elevado']),
      libre: estandar(colores.libre),
      occupied: estandar(colores.ocupada),
      off: new MeshStandardMaterial({ map: trama, roughness: 0.9, toneMapped: false }),
      pasillo: new MeshBasicMaterial({
        color: colores['linea-plano'],
        transparent: true,
        opacity: 0.45,
        toneMapped: false,
      }),
      lineBase: new LineBasicMaterial({ color: colores['linea-plano'], toneMapped: false }),
      lineActive: new LineBasicMaterial({ color: colores.lima, toneMapped: false }),
      geoSuelo: new BoxGeometry(ancho + MARGEN * 2, 0.1, fondo + MARGEN * 2),
      geoPasillo: new BoxGeometry(ancho, 0.004, plan.corridor.height / ESCALA),
    };
  }, [colores, ancho, fondo, plan.corridor.height]);

  useEffect(
    () => () => {
      Object.values(recursos).forEach((recurso) => recurso.dispose());
    },
    [recursos],
  );

  const salas = useMemo(
    () =>
      plan.rooms.map((sala) => ({
        sala,
        posicion: [
          (sala.x + sala.w / 2) / ESCALA - ancho / 2,
          (sala.y + sala.h / 2) / ESCALA - fondo / 2,
        ],
        tamano: [sala.w / ESCALA, sala.h / ESCALA],
      })),
    [plan.rooms, ancho, fondo],
  );

  const materialDe = { free: recursos.libre, occupied: recursos.occupied, off: recursos.off };
  const pasilloZ = (plan.corridor.y + plan.corridor.height / 2) / ESCALA - fondo / 2;

  return (
    <group scale={escalaEncuadre}>
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 8, 3]} intensity={0.7} />

      <mesh
        geometry={recursos.geoSuelo}
        material={recursos.suelo}
        position={[0, -0.05, 0]}
        onClick={() => onSelect(null)}
      />
      <mesh
        geometry={recursos.geoPasillo}
        material={recursos.pasillo}
        position={[0, 0.003, pasilloZ]}
      />

      {salas.map(({ sala, posicion, tamano }) => (
        <RoomShape
          key={sala.id}
          room={sala}
          statusLabel={ETIQUETAS[sala.status]}
          position={posicion}
          size={tamano}
          selected={sala.id === selectedId}
          material={materialDe[sala.status]}
          lineBase={recursos.lineBase}
          lineActive={recursos.lineActive}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}
