// Hero de la home: el edificio y, debajo, una pequeña historia que se cuenta sola una vez:
// se abre la Planta 2, aparece su plano, se elige una sala libre con su precio y sale el resumen de reserva.
// Cualquier clic en una planta o en una sala corta la historia y deja el control a la persona.
import { useEffect, useRef, useState } from 'react';
import BuildingHero from '@/components/building/BuildingHero/BuildingHero.jsx';
import MiniPlan from '@/components/floor-plan/MiniPlan/MiniPlan.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import { formatPrice } from '@/utils/formatPrice.js';
import { FLOOR_PLAN } from './floorPlanData.js';
import { FLOORS_HERO, HERO_STORY, roomsForFloor } from './heroBuildingData.js';
import styles from './HeroStory.module.css';

// Momentos de la historia (ms desde que empieza): abrir la planta, enseñar el plano, elegir sala, resumen.
const STEPS_AT = [900, 1700, 2400, 3100];

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function cheapestFree(rooms) {
  const free = rooms.filter((room) => room.status === 'free');
  if (free.length === 0) return '';
  return free.reduce((best, room) => (room.price < best.price ? room : best)).id;
}

export default function HeroStory({ buildingId, buildingName, startDelay = 0 }) {
  // step: 0 solo el edificio, 1 se abre la planta, 2 plano, 3 sala elegida, 4 resumen.
  const [step, setStep] = useState(() => (prefersReducedMotion() ? 4 : 0));
  const [floorId, setFloorId] = useState(HERO_STORY.floorId);
  const [openFloorId, setOpenFloorId] = useState(() =>
    prefersReducedMotion() ? HERO_STORY.floorId : '',
  );
  const [roomId, setRoomId] = useState(() => (prefersReducedMotion() ? HERO_STORY.roomId : ''));
  const timers = useRef([]);

  const stopStory = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    timers.current = STEPS_AT.map((at, index) =>
      setTimeout(() => {
        const next = index + 1;
        setStep(next);
        if (next === 1) setOpenFloorId(HERO_STORY.floorId);
        if (next === 3) setRoomId(HERO_STORY.roomId);
      }, startDelay + at),
    );
    return stopStory;
  }, [startDelay]);

  // Una planta elegida por la persona: se abre, se corta la historia y se preselecciona su sala libre más barata.
  function handleOpenFloor(id) {
    stopStory();
    const floor = FLOORS_HERO.find((item) => item.id === id);
    if (!floor) return;
    if (openFloorId === id) {
      setOpenFloorId('');
      setRoomId('');
      setStep(0);
      return;
    }
    setOpenFloorId(id);
    setRoomId(cheapestFree(roomsForFloor(floor)));
    setStep(4);
  }

  function handleSelectRoom(id) {
    stopStory();
    setRoomId(id);
    setStep(4);
  }

  const openFloor = FLOORS_HERO.find((floor) => floor.id === openFloorId) ?? null;
  const rooms = openFloor ? roomsForFloor(openFloor) : [];
  const room = rooms.find((item) => item.id === roomId) ?? null;
  const showCard = step >= 2 && openFloor;
  const total = HERO_STORY.hours * (room?.price ?? 0);

  return (
    <div className={styles.story}>
      <BuildingHero
        buildingId={buildingId}
        buildingName={buildingName}
        floors={FLOORS_HERO}
        activeFloorId={floorId}
        onSelectFloor={setFloorId}
        selectedFloorId={openFloorId}
        onOpenFloor={handleOpenFloor}
        showInfo={false}
        hint={step >= 4 ? 'Prueba: pulsa otra planta o sala.' : 'Pulsa una planta para abrirla.'}
      >
        {showCard && (
          <div className={styles.card} data-step={step}>
            <p className={styles.cardTitle}>
              {openFloor.name}
              {openFloor.off
                ? ' · no se alquila'
                : ` · ${openFloor.free} de ${openFloor.total} salas libres hoy`}
            </p>

            {openFloor.off ? (
              <p className={styles.cardText}>Recepción. Esta planta no se alquila.</p>
            ) : (
              <>
                <MiniPlan
                  rooms={rooms}
                  width={FLOOR_PLAN.width}
                  height={FLOOR_PLAN.height}
                  selectedId={step >= 3 ? roomId : ''}
                  onSelect={handleSelectRoom}
                />

                <div className={styles.summary} aria-live="polite">
                  {step >= 4 && room ? (
                    <>
                      <p className={styles.summaryRoom}>
                        {room.name} · hasta {room.people} personas
                        {room.equipment.length > 0 ? ` · ${room.equipment.join(', ')}` : ''}
                      </p>
                      <p className={styles.cardText}>
                        Hoy · {HERO_STORY.start}–{HERO_STORY.end} · {HERO_STORY.hours} h ×{' '}
                        {room.price} € = <strong>{formatPrice(total)}</strong>
                      </p>
                      <Button to={`/buildings/${buildingId}/floors/${openFloor.id}`}>
                        Reservar esta sala
                      </Button>
                    </>
                  ) : null}
                </div>
              </>
            )}
          </div>
        )}
      </BuildingHero>
    </div>
  );
}
