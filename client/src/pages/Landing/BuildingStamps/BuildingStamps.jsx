// Cabecera de la landing: el edificio 3D gira solo y, al bajar, las salas se van estampando sobre él. Pulsar una
// estampa abre su ficha (`?sala=<id>` en la URL) y desde ahí se reserva.
// Un solo progreso de scroll (`store`, escrito por useScrollProgress) mueve todo: las estampas (StampLayer), el empuje
// del giro y la apertura de las plantas (refs que lee el 3D) y la planta activa (el único estado de React, discreto).
// Niveles (useBuildingTier): 'full' fija el escenario y anima; 'calm' (movimiento reducido) deja el 3D quieto con las
// estampas ya puestas; 'static' (móvil, ahorro de datos o sin WebGL) no monta el 3D y muestra solo la lista de estampas.
import { lazy, startTransition, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import BuildingHero from '@/components/building/BuildingHero/BuildingHero.jsx';
import { useBuildingTier } from '@/hooks/useBuildingTier.js';
import { useScrollProgress } from '@/hooks/useScrollProgress.js';
import { openAt, spinKick, stampIndexAt } from '@/utils/scrollTimeline.js';
import { FLOORS_HERO, HERO_STORY } from '../heroBuildingData.js';
import styles from './BuildingStamps.module.css';
import StampLayer from './StampLayer/StampLayer.jsx';
import { HERO_STAMPS, STAMP_FLOOR_IDS } from './stampData.js';

const SEPARATION = 96; // px mínimos entre dos estampas del mismo lado (alto de una estampa compacta más aire)

// La ficha (hoja, panel y enlaces) solo se descarga al abrir una estampa.
const RoomSheet = lazy(() => import('./RoomSheet/RoomSheet.jsx'));

export default function BuildingStamps({ buildingId, buildingName, store }) {
  const tier = useBuildingTier();
  const full = tier === 'full';
  const [floorId, setFloorId] = useState(HERO_STORY.floorId);
  const [params, setParams] = useSearchParams();

  const pistaRef = useRef(null);
  const escenaRef = useRef(null);
  const capaRef = useRef(null);
  const listaRef = useRef(null);
  const spinKickRef = useRef(0);
  const openRef = useRef(0);
  const lastAnchors = useRef({});

  // Sin 3D la «pista» es la propia lista: el progreso se mide cuando esta aparece en pantalla.
  useScrollProgress(tier === 'static' ? listaRef : pistaRef, {
    store,
    mode: full ? 'pin' : 'view',
    pinRef: escenaRef,
  });

  // El progreso alimenta lo que mueve el 3D y marca la planta de la estampa que se está colocando.
  useEffect(
    () =>
      store.subscribe((p) => {
        spinKickRef.current = spinKick(p);
        openRef.current = openAt(p);
        const stamp = HERO_STAMPS[stampIndexAt(p, HERO_STAMPS.length)];
        if (stamp) setFloorId(stamp.floorId);
      }),
    [store],
  );

  // Las anclas llegan del 3D en cada fotograma. Cada estampa va a la altura de su planta, pero las plantas están más
  // juntas que una estampa: en cada lado se separan lo justo (SEPARATION px) para que no se tapen. Solo se escribe en el
  // DOM lo que cambia.
  const onFloorAnchors = useCallback((anchors) => {
    const capa = capaRef.current;
    if (!capa) return;
    const previous = [-Infinity, -Infinity]; // última altura usada en cada lado
    HERO_STAMPS.forEach((stamp, index) => {
      const anchor = anchors[stamp.floorId];
      if (!anchor) return;
      const side = index % 2;
      const y = Math.round(Math.max(anchor.y, previous[side] + SEPARATION));
      previous[side] = y;
      if (lastAnchors.current[index] === y) return;
      lastAnchors.current[index] = y;
      capa.style.setProperty(`--y-${index}`, `${y}px`);
    });
  }, []);

  const roomId = params.get('sala');
  const openStamp = HERO_STAMPS.find((stamp) => stamp.id === roomId) ?? null;
  const openSheet = useCallback(
    (id) => {
      startTransition(() => {
        setParams(
          (previous) => {
            const next = new URLSearchParams(previous);
            next.set('sala', id);
            return next;
          },
          { preventScrollReset: true },
        );
      });
    },
    [setParams],
  );
  const closeSheet = useCallback(() => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('sala');
        return next;
      },
      { preventScrollReset: true },
    );
  }, [setParams]);

  return (
    <div className={styles.raiz}>
      {tier === 'static' ? (
        <StampLayer
          ref={listaRef}
          stamps={HERO_STAMPS}
          mode="list"
          store={store}
          onOpen={openSheet}
        />
      ) : (
        <div ref={pistaRef} className={styles.pista}>
          <div ref={escenaRef} className={`${styles.escena} ${full ? styles.fija : ''}`}>
            <BuildingHero
              buildingId={buildingId}
              buildingName={buildingName}
              floors={FLOORS_HERO}
              activeFloorId={floorId}
              onSelectFloor={setFloorId}
              showInfo={false}
              showFloorList={false}
              building3dProps={{
                autoRotate: full,
                spinKickRef,
                openRef,
                anchorFloorIds: STAMP_FLOOR_IDS,
                onFloorAnchors,
                keyboardTurn: false,
              }}
            />
            <StampLayer
              ref={capaRef}
              stamps={HERO_STAMPS}
              mode="anchored"
              store={store}
              onOpen={openSheet}
            />
          </div>
          {full && <div className={styles.carrera} aria-hidden="true" />}
        </div>
      )}

      {openStamp && (
        <Suspense fallback={null}>
          <RoomSheet stamp={openStamp} buildingId={buildingId} onClose={closeSheet} />
        </Suspense>
      )}
    </div>
  );
}
