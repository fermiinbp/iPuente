// Home: hero con el edificio por plantas, buscador, salas destacadas, cómo funciona y llamada a empresas.
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import BuildingHero from '@/components/building/BuildingHero/BuildingHero.jsx';
import RoomCard from '@/components/room/RoomCard/RoomCard.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import EmptyState from '@/components/ui/EmptyState/EmptyState.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import Section from '@/components/ui/Section/Section.jsx';
import SectionTitle from '@/components/ui/SectionTitle/SectionTitle.jsx';
import CompaniesCta from './CompaniesCta.jsx';
import { BUILDING, DEFAULT_FLOOR_ID, FEATURED_ROOMS, ROOM_FILTERS } from './data.js';
import FloorSection from './FloorSection.jsx';
import { FLOORS_HERO } from './heroBuildingData.js';
import HowItWorks from './HowItWorks.jsx';
import styles from './Landing.module.css';
import LandingLoader from './LandingLoader.jsx';
import { heroEntranceDelay } from './loaderSession.js';
import { FLOOR_PLAN } from './floorPlanData.js';
import NearbySection from './NearbySection.jsx';
import RoomFilters from './RoomFilters.jsx';

// Dato de la primera pantalla: salas libres hoy y precio más bajo del plano de ejemplo.
const FREE_ROOMS = FLOOR_PLAN.rooms.filter((room) => room.status === 'free');
const FREE_COUNT = FREE_ROOMS.length;
const MIN_PRICE = Math.min(...FREE_ROOMS.map((room) => room.price));

export default function Landing() {
  usePageTitle('Salas por horas');
  const navigate = useNavigate();
  // Se calcula una sola vez, antes de que el cargador marque la sesión como vista.
  const [entranceDelay] = useState(heroEntranceDelay);
  const heroRef = useRef(null);

  // Foco de luz que sigue al ratón por el hero. Solo ratón: en táctil queda el resplandor fijo.
  function handleHeroPointerMove(event) {
    if (event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    heroRef.current?.style.setProperty('--mx', `${event.clientX - box.left}px`);
    heroRef.current?.style.setProperty('--my', `${event.clientY - box.top}px`);
  }
  const [floorId, setFloorId] = useState(DEFAULT_FLOOR_ID);
  const [filter, setFilter] = useState(ROOM_FILTERS[0]);

  const rooms =
    filter === ROOM_FILTERS[0] ? FEATURED_ROOMS : FEATURED_ROOMS.filter((r) => r.type === filter);
  // Con tres salas o más, la primera va grande y las demás en fila; con menos, tarjetas iguales.
  const featuredLayout = rooms.length >= 3;

  // De momento no hay ruta con el listado de edificios: se lleva al edificio de ejemplo con la búsqueda.
  function handleSearch(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    ['city', 'date', 'people'].forEach((key) => {
      const value = String(data.get(key) ?? '').trim();
      if (value) params.set(key, value);
    });
    const query = params.toString();
    navigate(`/buildings/${BUILDING.id}${query ? `?${query}` : ''}`);
  }

  return (
    <div className={styles.page}>
      <LandingLoader />

      <section
        ref={heroRef}
        className={styles.hero}
        onPointerMove={handleHeroPointerMove}
        aria-labelledby="hero-titulo"
        style={{ '--entrada-base': `${entranceDelay}ms` }}
      >
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <h1 className={styles.heroTitle} id="hero-titulo">
              Reserva salas por horas viendo el plano del edificio.
            </h1>
            <p className={styles.lead}>
              Abre la planta, mira qué salas están libres y cuánto cuestan, y paga online. Sin
              llamadas ni correos.
            </p>
            <p className={styles.fact}>
              <span className={styles.factDot} aria-hidden="true" />
              {FREE_COUNT} salas libres hoy en {BUILDING.name}, desde {MIN_PRICE} €/hora.
            </p>
            <form className={styles.search} aria-label="Buscar salas" onSubmit={handleSearch}>
              <div className={`${styles.field} ${styles.fieldCity}`}>
                <Input label="Ciudad" name="city" type="text" placeholder="Sevilla" />
              </div>
              <div className={styles.field}>
                <Input label="Fecha" name="date" type="date" />
              </div>
              <div className={styles.field}>
                <Input label="Personas" name="people" type="number" min="1" placeholder="10" />
              </div>
              <Button type="submit">Buscar</Button>
            </form>
          </div>

          <div className={styles.heroBuilding}>
            <BuildingHero
              buildingId={BUILDING.id}
              buildingName={BUILDING.name}
              floors={FLOORS_HERO}
              activeFloorId={floorId}
              onSelectFloor={setFloorId}
            />
          </div>
        </div>
      </section>

      <FloorSection />
      <NearbySection />

      <Section id="salas" titleId="salas-titulo" decor="grid">
        <div className={styles.roomsHead}>
          <SectionTitle id="salas-titulo">Salas destacadas</SectionTitle>
          <RoomFilters filters={ROOM_FILTERS} active={filter} onChange={setFilter} />
        </div>
        {rooms.length > 0 ? (
          <ul className={`${styles.grid} ${featuredLayout ? styles.gridFeatured : ''}`}>
            {rooms.map((room, index) => (
              <li
                key={room.id}
                className={featuredLayout && index === 0 ? styles.featuredItem : ''}
              >
                <RoomCard
                  room={room}
                  variant={featuredLayout ? (index === 0 ? 'featured' : 'compact') : 'default'}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.empty} role="status">
            <EmptyState title="No hay salas de este tipo todavía." text="Prueba con otro filtro." />
          </div>
        )}
      </Section>

      <HowItWorks />
      <CompaniesCta />
    </div>
  );
}
