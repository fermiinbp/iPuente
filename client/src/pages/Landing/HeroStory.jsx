// Hero de la home: el edificio en 3D. Pulsar una planta la abre en la maqueta (las de encima suben y se desvanecen).
// El selector de plantas con salas y plano vive aparte, en FloorSection, y no depende de este.
import { useState } from 'react';
import BuildingHero from '@/components/building/BuildingHero/BuildingHero.jsx';
import { FLOORS_HERO, HERO_STORY } from './heroBuildingData.js';

export default function HeroStory({ buildingId, buildingName }) {
  const [floorId, setFloorId] = useState(HERO_STORY.floorId);

  return (
    <BuildingHero
      buildingId={buildingId}
      buildingName={buildingName}
      floors={FLOORS_HERO}
      activeFloorId={floorId}
      onSelectFloor={setFloorId}
      showInfo={false}
      showFloorList={false}
    />
  );
}
