// Interior de una sala del plano 3D: paredes con puerta al pasillo, mesa con sillas y halo de luz.
// La luz se enciende y se apaga con un fundido (mutando refs en useFrame, sin setState).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BoxGeometry, PlaneGeometry } from 'three';

const ALTURA_SUELO = 0.13;
const ALTURA_PARED = 0.3;
const GROSOR = 0.04;
const ANCHO_PUERTA = 0.46;
const VELOCIDAD = 6;
const UMBRAL = 0.01;
const OPACIDAD_HALO = 0.8;

// Paredes de la sala: cuatro tramos, y el del lado del pasillo se parte en dos para dejar la puerta.
function tramosDePared([ancho, fondo], ladoPuerta) {
  const mx = ancho / 2;
  const mz = fondo / 2;
  const lateral = { y: ALTURA_PARED / 2 };
  const tramos = [
    { size: [GROSOR, ALTURA_PARED, fondo], pos: [-mx, lateral.y, 0] },
    { size: [GROSOR, ALTURA_PARED, fondo], pos: [mx, lateral.y, 0] },
  ];
  const lado = (z, conPuerta) => {
    if (!conPuerta) {
      tramos.push({ size: [ancho, ALTURA_PARED, GROSOR], pos: [0, lateral.y, z] });
      return;
    }
    const largo = (ancho - ANCHO_PUERTA) / 2;
    tramos.push({ size: [largo, ALTURA_PARED, GROSOR], pos: [-mx + largo / 2, lateral.y, z] });
    tramos.push({ size: [largo, ALTURA_PARED, GROSOR], pos: [mx - largo / 2, lateral.y, z] });
  };
  lado(-mz, ladoPuerta === -1);
  lado(mz, ladoPuerta === 1);
  return tramos;
}

export default function RoomInterior({ size, doorSide, lit, furnished, recursos, reducedMotion }) {
  const invalidate = useThree((estado) => estado.invalidate);
  const halo = useRef(null);
  const [ancho, fondo] = size;

  const tramos = useMemo(() => tramosDePared(size, doorSide), [size, doorSide]);
  const geometrias = useMemo(
    () => ({
      paredes: tramos.map((t) => new BoxGeometry(...t.size)),
      mesa: new BoxGeometry(ancho * 0.42, 0.05, fondo * 0.26),
      silla: new BoxGeometry(0.11, 0.07, 0.11),
      halo: new PlaneGeometry(ancho * 1.3, fondo * 1.3),
    }),
    [tramos, ancho, fondo],
  );
  // La opacidad inicial se fija al montar; después la lleva useFrame con un fundido, sin pasar por React.
  const [opacidadInicial] = useState(lit ? OPACIDAD_HALO : 0);

  useEffect(
    () => () => {
      Object.values(geometrias)
        .flat()
        .forEach((geo) => geo.dispose());
    },
    [geometrias],
  );

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

  const sillas = [
    [-ancho * 0.12, -fondo * 0.2],
    [ancho * 0.12, -fondo * 0.2],
    [-ancho * 0.12, fondo * 0.2],
    [ancho * 0.12, fondo * 0.2],
  ];

  return (
    <group>
      {tramos.map((tramo, i) => (
        <mesh
          key={i}
          geometry={geometrias.paredes[i]}
          material={recursos.pared}
          position={[tramo.pos[0], ALTURA_SUELO + tramo.pos[1] - 0.04, tramo.pos[2]]}
        />
      ))}

      {furnished && (
        <>
          <mesh
            geometry={geometrias.mesa}
            material={recursos.mesa}
            position={[0, ALTURA_SUELO + 0.05, 0]}
          />
          {sillas.map(([x, z], i) => (
            <mesh
              key={i}
              geometry={geometrias.silla}
              material={recursos.silla}
              position={[x, ALTURA_SUELO + 0.03, z]}
            />
          ))}
        </>
      )}

      <mesh
        geometry={geometrias.halo}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, ALTURA_SUELO + 0.04, 0]}
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
