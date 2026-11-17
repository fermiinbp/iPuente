// Plano 3D de una planta: suelo, pasillo y salas como cajas bajas coloreadas por su estado.
// Se usa dentro de un <LazyCanvas>. Los materiales y geometrías se crean una vez; la sala elegida se eleva.
import { useEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  CanvasTexture,
  SphereGeometry,
  LineBasicMaterial,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { useFrame, useThree } from '@react-three/fiber';
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
  'papel',
  'bronce',
  'bronce-claro',
  'crema-suave',
  'bosque-profundo',
];

// Iluminación general: sube con cada sala encendida. Todas encendidas equivale a la luz de siempre.
const AMBIENTE_APAGADO = 0.42;
const AMBIENTE_ENCENDIDO = 1.1;
const SOL_APAGADO = 0.3;
const SOL_ENCENDIDO = 0.7;
const VELOCIDAD_LUZ = 5;

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

// Halo de luz: degradado radial blanco que se tiñe de cálido con el color del material.
function crearHalo() {
  const lienzo = document.createElement('canvas');
  lienzo.width = 128;
  lienzo.height = 128;
  const cx = lienzo.getContext('2d');
  const degradado = cx.createRadialGradient(64, 64, 4, 64, 64, 64);
  degradado.addColorStop(0, 'rgba(255,255,255,1)');
  degradado.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  degradado.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = degradado;
  cx.fillRect(0, 0, 128, 128);
  return new CanvasTexture(lienzo);
}

// Luces de la planta: su intensidad sigue a la fracción de salas encendidas con un fundido.
function Ambiente({ fraccion, reducedMotion }) {
  const invalidate = useThree((estado) => estado.invalidate);
  const ambiente = useRef(null);
  const sol = useRef(null);
  const actual = useRef(fraccion);

  useEffect(() => {
    if (reducedMotion) actual.current = fraccion;
    invalidate();
  }, [fraccion, reducedMotion, invalidate]);

  useFrame((_, delta) => {
    const resto = fraccion - actual.current;
    if (Math.abs(resto) > 0.002) {
      actual.current += resto * Math.min(1, delta * VELOCIDAD_LUZ);
      invalidate();
    } else {
      actual.current = fraccion;
    }
    const t = actual.current;
    if (ambiente.current) {
      ambiente.current.intensity = AMBIENTE_APAGADO + (AMBIENTE_ENCENDIDO - AMBIENTE_APAGADO) * t;
    }
    if (sol.current) sol.current.intensity = SOL_APAGADO + (SOL_ENCENDIDO - SOL_APAGADO) * t;
  });

  return (
    <>
      <ambientLight ref={ambiente} intensity={AMBIENTE_APAGADO} />
      <directionalLight ref={sol} position={[4, 8, 3]} intensity={SOL_APAGADO} />
    </>
  );
}

export default function FloorPlan({ plan, selectedId, onSelect, litIds = [], onToggleLight }) {
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
      // Interior de las salas: compartido por todas.
      texturaHalo: crearHalo(),
      colorLuz: colores['bronce-claro'],
      pared: new MeshStandardMaterial({ color: colores.papel, roughness: 0.7, toneMapped: false }),
      mesa: new MeshStandardMaterial({
        color: colores.bronce,
        roughness: 0.6,
        toneMapped: false,
      }),
      silla: new MeshStandardMaterial({
        color: colores['crema-suave'],
        roughness: 0.8,
        toneMapped: false,
      }),
      lamparaOn: new MeshBasicMaterial({ color: colores['bronce-claro'], toneMapped: false }),
      lamparaOff: new MeshBasicMaterial({
        color: colores['bosque-profundo'],
        toneMapped: false,
      }),
      geoLampara: new SphereGeometry(0.06, 16, 12),
    };
  }, [colores, ancho, fondo, plan.corridor.height]);

  useEffect(
    () => () => {
      Object.values(recursos).forEach((recurso) => recurso.dispose?.());
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
  const encendidas = new Set(litIds);
  const fraccionEncendida = plan.rooms.length > 0 ? encendidas.size / plan.rooms.length : 0;
  const pasilloZ = (plan.corridor.y + plan.corridor.height / 2) / ESCALA - fondo / 2;

  return (
    <group scale={escalaEncuadre}>
      <Ambiente fraccion={fraccionEncendida} reducedMotion={reducedMotion} />

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
          recursos={recursos}
          doorSide={sala.y < plan.corridor.y ? 1 : -1}
          lit={encendidas.has(sala.id)}
          canLight={sala.status !== 'off'}
          onToggleLight={onToggleLight}
        />
      ))}
    </group>
  );
}
