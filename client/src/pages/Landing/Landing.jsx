// Home: hero con el edificio por plantas, buscador, salas destacadas, cómo funciona y llamada a empresas.
import { useState } from 'react';
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
import NearbySection from './NearbySection.jsx';
import RoomFilters from './RoomFilters.jsx';

export default function Landing() {
  usePageTitle('Salas por horas');
  const navigate = useNavigate();
  const [floorId, setFloorId] = useState(DEFAULT_FLOOR_ID);
  const [filter, setFilter] = useState(ROOM_FILTERS[0]);

  const rooms =
    filter === ROOM_FILTERS[0] ? FEATURED_ROOMS : FEATURED_ROOMS.filter((r) => r.type === filter);

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

      <section className={styles.hero} aria-labelledby="hero-titulo">
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <h1 className={styles.heroTitle} id="hero-titulo">
              Elige tu sala sin ir a ciegas.
            </h1>
            <p className={styles.lead}>
              Mira el edificio, abre la planta y comprueba qué salas están libres. Reservas por
              horas y pagas online.
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
            <p className={styles.hint}>Pronto filtraremos por ciudad, fecha y personas.</p>
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

      <Section id="salas" titleId="salas-titulo" tone="elevated">
        <div className={styles.roomsHead}>
          <SectionTitle id="salas-titulo">Salas destacadas</SectionTitle>
          <RoomFilters filters={ROOM_FILTERS} active={filter} onChange={setFilter} />
        </div>
        {rooms.length > 0 ? (
          <ul className={styles.grid}>
            {rooms.map((room) => (
              <li key={room.id}>
                <RoomCard room={room} />
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
