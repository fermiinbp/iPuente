// Interior de una sala del plano 3D: paredes con puerta al pasillo, el mobiliario que sale de sus datos
// (tipo, capacidad y equipamiento) y un halo de luz. Todo es low-poly y las piezas repetidas (sillas) van instanciadas.
// La luz se enciende y se apaga con un fundido (mutando refs en useFrame, sin setState).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BoxGeometry, Object3D, PlaneGeometry } from 'three';

const ALTURA_SUELO = 0.13;
const ALTURA_PARED = 0.3;
// Las paredes que dan a la cámara (derecha y delantera) son bajas, como un corte de maqueta: así se ve el interior.
const ALTURA_BAJA = 0.09;
const GROSOR = 0.04;
const ANCHO_PUERTA = 0.46;
const VELOCIDAD = 6;
const UMBRAL = 0.01;
const OPACIDAD_HALO = 0.8;
const MAX_SILLAS = 10;

// Paredes de la sala: cuatro tramos, y el del lado del pasillo se parte en dos para dejar la puerta.
// Las de la derecha (+x) y la delantera (+z) son bajas para ver dentro; las otras, altas.
function tramosDePared([ancho, fondo], ladoPuerta) {
  const mx = ancho / 2;
  const mz = fondo / 2;
  const tramos = [
    { size: [GROSOR, ALTURA_PARED, fondo], pos: [-mx, ALTURA_PARED / 2, 0] },
    { size: [GROSOR, ALTURA_BAJA, fondo], pos: [mx, ALTURA_BAJA / 2, 0] },
  ];
  const lado = (z, conPuerta) => {
    const h = z > 0 ? ALTURA_BAJA : ALTURA_PARED;
    if (!conPuerta) {
      tramos.push({ size: [ancho, h, GROSOR], pos: [0, h / 2, z] });
      return;
    }
    const largo = (ancho - ANCHO_PUERTA) / 2;
    tramos.push({ size: [largo, h, GROSOR], pos: [-mx + largo / 2, h / 2, z] });
    tramos.push({ size: [largo, h, GROSOR], pos: [mx - largo / 2, h / 2, z] });
  };
  lado(-mz, ladoPuerta === -1);
  lado(mz, ladoPuerta === 1);
  return tramos;
}

// Qué lleva la sala según sus datos. `tipo`: sala (reuniones), box (privado) o comun (zona común).
function contenidoDeSala(room, [ancho, fondo]) {
  const equipo = room.equipment ?? [];
  const tipo = room.tipo ?? 'sala';
  if (tipo === 'comun') return { tipo, sofa: true };

  const sillas = Math.min(Math.max(room.people ?? 4, 2), MAX_SILLAS);
  const porLado = Math.ceil(sillas / 2);
  const largoMesa = Math.min(ancho * 0.7, 0.14 * porLado + 0.1);
  const fondoMesa = tipo === 'box' ? fondo * 0.2 : fondo * 0.26;
  // Sillas repartidas a lo largo de los dos lados largos de la mesa.
  const posiciones = [];
  for (let i = 0; i < sillas; i += 1) {
    const lado = i % 2 === 0 ? -1 : 1;
    const indice = Math.floor(i / 2);
    const paso = largoMesa / porLado;
    posiciones.push([-largoMesa / 2 + paso * (indice + 0.5), lado * (fondoMesa / 2 + 0.09)]);
  }
  return {
    tipo,
    mesa: [largoMesa, fondoMesa],
    posiciones,
    pantalla: ['pantalla', 'proyector', 'videoconferencia'].some((e) => equipo.includes(e)),
    pizarra: equipo.includes('pizarra'),
  };
}

export default function RoomInterior({ room, size, doorSide, lit, recursos, reducedMotion }) {
  const invalidate = useThree((estado) => estado.invalidate);
  const halo = useRef(null);
  const sillasRef = useRef(null);
  const [ancho, fondo] = size;

  const tramos = useMemo(() => tramosDePared(size, doorSide), [size, doorSide]);
  const contenido = useMemo(() => contenidoDeSala(room, size), [room, size]);

  const geometrias = useMemo(
    () => ({
      paredes: tramos.map((t) => new BoxGeometry(...t.size)),
      mesa: contenido.mesa ? new BoxGeometry(contenido.mesa[0], 0.05, contenido.mesa[1]) : null,
      sofa: new BoxGeometry(0.2, 0.08, Math.min(fondo * 0.6, 0.7)),
      respaldo: new BoxGeometry(0.04, 0.12, Math.min(fondo * 0.6, 0.7)),
      mesaBaja: new BoxGeometry(0.24, 0.04, 0.16),
      pantalla: new BoxGeometry(0.025, 0.15, Math.min(fondo * 0.55, 0.75)),
      pizarra: new BoxGeometry(Math.min(ancho * 0.22, 0.42), 0.12, 0.025),
      halo: new PlaneGeometry(ancho * 1.3, fondo * 1.3),
    }),
    [tramos, contenido, ancho, fondo],
  );

  // La opacidad inicial se fija al montar; después la lleva useFrame con un fundido, sin pasar por React.
  const [opacidadInicial] = useState(lit ? OPACIDAD_HALO : 0);

  useEffect(
    () => () => {
      Object.values(geometrias)
        .flat()
        .forEach((geo) => geo?.dispose());
    },
    [geometrias],
  );

  // Sillas: un solo InstancedMesh por sala; las matrices se calculan una vez, no por fotograma.
  useLayoutEffect(() => {
    const malla = sillasRef.current;
    if (!malla || !contenido.posiciones) return;
    const auxiliar = new Object3D();
    contenido.posiciones.forEach(([x, z], i) => {
      auxiliar.position.set(x, ALTURA_SUELO + 0.03, z);
      auxiliar.updateMatrix();
      malla.setMatrixAt(i, auxiliar.matrix);
    });
    malla.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [contenido, invalidate]);

  useEffect(() => {
    if (reducedMotion && halo.current) halo.current.opacity = lit ? OPACIDAD_HALO : 0;
    invalidate();
  }, [lit, reducedMotion, invalidate]);

  useFrame((_, delta) => {
    const material = halo.current;
    if (!material) return;
    const objetivo = lit ? OPACIDAD_HALO : 0;
    const resto = objetivo - material.opacity;
    if (Math.abs(resto) < UMBRAL) {
      material.opacity = objetivo;
      return;
    }
    material.opacity += resto * Math.min(1, delta * VELOCIDAD);
    invalidate();
  });

  const suelo = ALTURA_SUELO;
  // La pantalla va en la pared izquierda (siempre alta y sin puerta). La pizarra, en la pared trasera:
  // junto a la puerta si la puerta está en esa pared, para no taparla.
  const largoLado = (ancho - ANCHO_PUERTA) / 2;
  const xPizarra = doorSide === -1 ? -(ANCHO_PUERTA / 2 + largoLado / 2) : 0;

  return (
    <group>
      {tramos.map((tramo, i) => (
        <mesh
          key={i}
          geometry={geometrias.paredes[i]}
          material={recursos.pared}
          position={[tramo.pos[0], suelo + tramo.pos[1] - 0.04, tramo.pos[2]]}
        />
      ))}

      {geometrias.mesa && (
        <mesh
          geometry={geometrias.mesa}
          material={contenido.tipo === 'box' ? recursos.escritorio : recursos.mesa}
          position={[0, suelo + 0.05, 0]}
        />
      )}

      {contenido.posiciones && (
        <instancedMesh
          // La clave fuerza un InstancedMesh nuevo si cambia el número de sillas.
          key={contenido.posiciones.length}
          ref={sillasRef}
          args={[recursos.geoSilla, recursos.silla, contenido.posiciones.length]}
        />
      )}

      {contenido.pantalla && (
        <mesh
          geometry={geometrias.pantalla}
          material={lit ? recursos.pantallaOn : recursos.pantallaOff}
          position={[-ancho / 2 + 0.035, suelo + 0.17, 0]}
        />
      )}

      {contenido.pizarra && (
        <mesh
          geometry={geometrias.pizarra}
          material={recursos.pizarra}
          position={[xPizarra, suelo + 0.16, -fondo / 2 + 0.035]}
        />
      )}

      {contenido.sofa && (
        <>
          <mesh
            geometry={geometrias.sofa}
            material={recursos.sofa}
            position={[-ancho / 2 + 0.16, suelo + 0.06, 0]}
          />
          <mesh
            geometry={geometrias.respaldo}
            material={recursos.sofa}
            position={[-ancho / 2 + 0.06, suelo + 0.12, 0]}
          />
          <mesh
            geometry={geometrias.mesaBaja}
            material={recursos.mesa}
            position={[-ancho * 0.12, suelo + 0.04, 0]}
          />
          <mesh
            geometry={recursos.geoMaceta}
            material={recursos.maceta}
            position={[ancho / 2 - 0.2, suelo + 0.05, fondo / 2 - 0.2]}
          />
          <mesh
            geometry={recursos.geoPlanta}
            material={recursos.planta}
            position={[ancho / 2 - 0.2, suelo + 0.17, fondo / 2 - 0.2]}
          />
        </>
      )}

      <mesh
        geometry={geometrias.halo}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, suelo + 0.04, 0]}
        renderOrder={2}
      >
        <meshBasicMaterial
          ref={halo}
          map={recursos.texturaHalo}
          color={recursos.colorLuz}
          transparent
          opacity={opacidadInicial}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
