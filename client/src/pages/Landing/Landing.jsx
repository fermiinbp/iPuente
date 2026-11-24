// Home: hero con el edificio por plantas, buscador, salas destacadas, cómo funciona y llamada a empresas.
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import RoomCard from '@/components/room/RoomCard/RoomCard.jsx';
import SearchBar from '@/components/search/SearchBar/SearchBar.jsx';
import EmptyState from '@/components/ui/EmptyState/EmptyState.jsx';
import Section from '@/components/ui/Section/Section.jsx';
import SectionTitle from '@/components/ui/SectionTitle/SectionTitle.jsx';
import { createProgressStore } from '@/utils/progressStore.js';
import BuildingBackdrop from './BuildingStamps/BuildingBackdrop/BuildingBackdrop.jsx';
import BuildingStamps from './BuildingStamps/BuildingStamps.jsx';
import CompaniesCta from './CompaniesCta/CompaniesCta.jsx';
import { BUILDING, FEATURED_ROOMS, ROOM_FILTERS } from './data.js';
import FloorSection from './FloorSection/FloorSection.jsx';
import HowItWorks from './HowItWorks/HowItWorks.jsx';
import styles from './Landing.module.css';
import LandingLoader from './LandingLoader/LandingLoader.jsx';
import { heroEntranceDelay } from './loaderSession.js';
import NearbySection from './NearbySection/NearbySection.jsx';
import CategoryFilters from '@/components/search/CategoryFilters/CategoryFilters.jsx';

export default function Landing() {
  usePageTitle('Salas por horas');
  const navigate = useNavigate();
  // Se calcula una sola vez, antes de que el cargador marque la sesión como vista.
  const [entranceDelay] = useState(heroEntranceDelay);
  const heroRef = useRef(null);
  // Un único progreso de scroll de la cabecera: lo escribe BuildingStamps y lo leen el edificio, las estampas y el fondo.
  const [scroll] = useState(createProgressStore);

  // Foco de luz que sigue al ratón por el hero. Solo ratón: en táctil queda el resplandor fijo.
  function handleHeroPointerMove(event) {
    if (event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    heroRef.current?.style.setProperty('--mx', `${event.clientX - box.left}px`);
    heroRef.current?.style.setProperty('--my', `${event.clientY - box.top}px`);
  }
  const [filter, setFilter] = useState(ROOM_FILTERS[0]);

  const rooms =
    filter === ROOM_FILTERS[0] ? FEATURED_ROOMS : FEATURED_ROOMS.filter((r) => r.type === filter);
  // Con tres salas o más, la primera va grande y las demás en fila; con menos, tarjetas iguales.
  const featuredLayout = rooms.length >= 3;

  // La búsqueda lleva a /search con la ciudad, la fecha y las personas elegidas.
  function handleSearch(values) {
    const params = new URLSearchParams();
    ['city', 'date', 'people'].forEach((key) => {
      if (values[key]) params.set(key, values[key]);
    });
    const query = params.toString();
    navigate(`/search${query ? `?${query}` : ''}`);
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
        <BuildingBackdrop store={scroll} />
        <div className={styles.heroInner}>
          {/* En móvil no existe (display: contents); en escritorio fija texto y buscador junto al edificio. */}
          <div className={styles.heroLeft}>
            <div className={styles.heroText}>
              <p className={styles.eyebrow}>Salas de oficina por horas</p>
              <h1 className={styles.heroTitle} id="hero-titulo">
                Elige tu sala en el plano y resérvala por horas.
              </h1>
              <p className={styles.lead}>
                iPuente te enseña cada planta del edificio con sus salas libres, su precio y su
                capacidad. Para equipos y profesionales que necesitan una sala unas horas: eliges
                las horas y listo.
              </p>
            </div>

            <SearchBar
              variant="hero"
              className={styles.search}
              submitLabel="Buscar salas"
              onSearch={handleSearch}
            />
          </div>

          <div className={styles.heroBuilding}>
            <BuildingStamps buildingId={BUILDING.id} buildingName={BUILDING.name} store={scroll} />
          </div>
        </div>
      </section>

      <FloorSection buildingName={BUILDING.name} />
      <HowItWorks />
      <NearbySection />

      <Section id="salas" titleId="salas-titulo" decor="grid">
        <div className={styles.roomsHead}>
          <SectionTitle id="salas-titulo">Salas destacadas</SectionTitle>
          <CategoryFilters filters={ROOM_FILTERS} active={filter} onChange={setFilter} />
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

      <CompaniesCta />
    </div>
  );
}
