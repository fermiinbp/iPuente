// Hero de la home: el edificio en 3D. Al bajar la página las plantas se abren solas, de arriba abajo (las de encima
// suben y se desvanecen), con el mismo resultado que pulsar una planta; también se abren pulsándolas.
// Escritorio: el edificio queda fijado mientras se recorre la «carrera» del hero y el progreso es el del hero entero
// (`pinRef`). Móvil y tablet: sin fijado, el progreso es el del propio edificio al cruzar la pantalla.
// Con prefers-reduced-motion el scroll no abre nada (useScrollProgress no avisa) y no hay carrera.
// En escritorio una leyenda (HeroFloorNote) dice qué planta está abierta, en el hueco de la carrera.
// El selector de plantas con salas y plano vive aparte, en FloorSection, y no depende de este.
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import BuildingHero from '@/components/building/BuildingHero/BuildingHero.jsx';
import { useMediaQuery } from '@/hooks/useMediaQuery.js';
import { useScrollProgress } from '@/hooks/useScrollProgress.js';
import { FLOORS_HERO, HERO_STORY } from './heroBuildingData.js';
import HeroFloorNote from './HeroFloorNote/HeroFloorNote.jsx';
import { floorForProgress } from './heroScroll.js';

export default function HeroStory({ buildingId, buildingName, pinRef, noteContainer }) {
  const [floorId, setFloorId] = useState(HERO_STORY.floorId);
  // Planta abierta en el 3D ('' = ninguna). Con `selectedFloorId` el hero la decide desde aquí.
  const [openId, setOpenId] = useState('');
  const ownRef = useRef(null);
  const lastTarget = useRef('');
  const pinned = useMediaQuery('(min-width: 960px)');
  const mode = pinned ? 'pin' : 'view';

  // Solo se actúa cuando cambia la planta que toca: si la persona abre o cierra una a mano, el scroll no la pisa
  // hasta que cruce a otra.
  function handleProgress(progress) {
    const target = floorForProgress(progress, mode);
    if (target === lastTarget.current) return;
    lastTarget.current = target;
    if (target) setFloorId(target);
    setOpenId(target);
  }

  useScrollProgress(pinned ? pinRef : ownRef, { mode, onProgress: handleProgress });

  const openFloor = FLOORS_HERO.find((floor) => floor.id === openId);

  return (
    <div ref={ownRef}>
      <BuildingHero
        buildingId={buildingId}
        buildingName={buildingName}
        floors={FLOORS_HERO}
        activeFloorId={floorId}
        onSelectFloor={setFloorId}
        selectedFloorId={openId}
        onOpenFloor={(id) => setOpenId((current) => (current === id ? '' : id))}
        showInfo={false}
        showFloorList={false}
      />
      {/* La leyenda va al hueco de la carrera del hero, a la izquierda del edificio fijado. */}
      {noteContainer &&
        createPortal(<HeroFloorNote buildingId={buildingId} floor={openFloor} />, noteContainer)}
    </div>
  );
}
