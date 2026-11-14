// Escena 3D de «Alrededor del edificio»: mapa inclinado con el edificio en verde libre y los puntos cercanos.
// Cámara fija: es el grupo el que se inclina y se gira, como el mockup (rotateX y rotateZ). Se importa con React.lazy.
import { useEffect, useMemo } from 'react';
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
} from 'three';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useCssColors } from '@/hooks/useCssColors.js';
import styles from './NearbyMap.module.css';

const TILT = 0.66; // unos 38 grados de elevación
const TURN = -0.56; // unos -32 grados de giro
const GROUND = [12, 8.6];
const STREETS_X = [-3.7, -1.7, 1.7, 3.7];
const STREETS_Z = [-3, -1.3, 1.3, 3];
const STREET_HALF = 0.12;
const NOMBRES = [
  'bosque-elevado',
  'linea-plano',
  'bronce',
  'libre',
  'bosque-profundo',
  'crema',
  'lima',
];

function streetsGeometry() {
  const puntos = [];
  const [ancho, fondo] = GROUND;
  for (const x of STREETS_X) {
    for (const lado of [-STREET_HALF, STREET_HALF]) {
      puntos.push(x + lado, 0.01, -fondo / 2, x + lado, 0.01, fondo / 2);
    }
  }
  for (const z of STREETS_Z) {
    for (const lado of [-STREET_HALF, STREET_HALF]) {
      puntos.push(-ancho / 2, 0.01, z + lado, ancho / 2, 0.01, z + lado);
    }
  }
  const geometria = new BufferGeometry();
  geometria.setAttribute('position', new Float32BufferAttribute(puntos, 3));
  return geometria;
}

function linkGeometry([x, z]) {
  const geometria = new BufferGeometry();
  geometria.setAttribute('position', new Float32BufferAttribute([0, 0.05, 0, x, 0.05, z], 3));
  return geometria;
}

// Con frameloop demand, repinta cuando cambia el punto activo.
function Redraw({ activeId }) {
  const invalidate = useThree((estado) => estado.invalidate);
  useEffect(() => {
    invalidate();
  }, [activeId, invalidate]);
  return null;
}

export default function NearbyMap({ building, places, activeId }) {
  const c = useCssColors(NOMBRES);
  const [bw, bh, bd] = building.size;

  const geo = useMemo(() => {
    const caja = new BoxGeometry(bw, bh, bd);
    return {
      ground: new PlaneGeometry(GROUND[0], GROUND[1]).rotateX(-Math.PI / 2),
      streets: streetsGeometry(),
      box: caja,
      edges: new EdgesGeometry(caja),
      pin: new CylinderGeometry(0.1, 0.1, 0.5, 16),
      pinHead: new SphereGeometry(0.17, 20, 16),
      ring: new RingGeometry(1.35, 1.45, 48).rotateX(-Math.PI / 2),
      links: places.map((p) => linkGeometry(p.position)),
    };
  }, [bw, bh, bd, places]);

  const mat = useMemo(
    () => ({
      ground: new MeshBasicMaterial({ color: c['bosque-elevado'] }),
      street: new LineBasicMaterial({ color: c['linea-plano'] }),
      // Orden de las caras de BoxGeometry: +x, -x, +y, -y, +z, -z.
      box: [
        new MeshBasicMaterial({ color: c.libre }),
        new MeshBasicMaterial({ color: c.libre }),
        new MeshBasicMaterial({ color: c.libre }),
        new MeshBasicMaterial({ color: c.libre }),
        new MeshBasicMaterial({ color: c.libre }),
        new MeshBasicMaterial({ color: c.libre }),
      ],
      edge: new LineBasicMaterial({ color: c['bosque-profundo'] }),
      here: new MeshBasicMaterial({ color: c['crema'] }),
      pin: new MeshBasicMaterial({ color: c['bronce'] }),
      pinActive: new MeshBasicMaterial({ color: c['lima'] }),
      link: new LineBasicMaterial({ color: c['bronce'] }),
      linkActive: new LineBasicMaterial({ color: c['lima'] }),
    }),
    [c],
  );

  // Libera de la GPU lo creado cuando la escena se desmonta o se recrea.
  useEffect(
    () => () => {
      for (const g of Object.values(geo)) {
        if (Array.isArray(g)) g.forEach((x) => x.dispose());
        else g.dispose();
      }
    },
    [geo],
  );
  useEffect(
    () => () => {
      for (const m of Object.values(mat)) {
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    },
    [mat],
  );

  return (
    <group rotation={[TILT, TURN, 0]}>
      <Redraw activeId={activeId} />
      <mesh geometry={geo.ground} material={mat.ground} />
      <lineSegments geometry={geo.streets} material={mat.street} />

      <mesh geometry={geo.ring} material={mat.here} position={[0, 0.02, 0]} />
      <mesh geometry={geo.box} material={mat.box} position={[0, bh / 2, 0]} />
      <lineSegments geometry={geo.edges} material={mat.edge} position={[0, bh / 2, 0]} />
      <Html position={[0, bh + 0.35, 0]} center zIndexRange={[10, 0]} className={styles.html}>
        <div aria-hidden="true" className={styles.here}>
          <span className={styles.hereTag}>Estás aquí</span>
          <span className={styles.hereName}>{building.name}</span>
        </div>
      </Html>

      {places.map((p, i) => {
        const activo = p.id === activeId;
        const [x, z] = p.position;
        return (
          <group key={p.id}>
            <lineSegments geometry={geo.links[i]} material={activo ? mat.linkActive : mat.link} />
            <group position={[x, 0, z]}>
              <mesh
                geometry={geo.pin}
                material={activo ? mat.pinActive : mat.pin}
                position={[0, 0.25, 0]}
              />
              <mesh
                geometry={geo.pinHead}
                material={activo ? mat.pinActive : mat.pin}
                position={[0, 0.6, 0]}
              />
              <Html position={[0, 1.05, 0]} center zIndexRange={[10, 0]} className={styles.html}>
                <div aria-hidden="true" className={activo ? styles.chipActive : styles.chip}>
                  {p.name} · {p.shortTime}
                </div>
              </Html>
            </group>
          </group>
        );
      })}
    </group>
  );
}
