// Home: hero con el edificio por plantas, buscador, salas destacadas, cómo funciona y llamada a empresas.
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import RoomCard from '@/components/room/RoomCard/RoomCard.jsx';
import SearchBar from '@/components/search/SearchBar/SearchBar.jsx';
import EmptyState from '@/components/ui/EmptyState/EmptyState.jsx';
import Section from '@/components/ui/Section/Section.jsx';
import SectionTitle from '@/components/ui/SectionTitle/SectionTitle.jsx';
import CompaniesCta from './CompaniesCta/CompaniesCta.jsx';
import { BUILDING, FEATURED_ROOMS, ROOM_FILTERS } from './data.js';
import FloorSection from './FloorSection/FloorSection.jsx';
import HeroStory from './HeroStory.jsx';
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
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>Salas de oficina por horas en Sevilla</p>
            <h1 className={styles.heroTitle} id="hero-titulo">
              Mira qué sala está libre en el plano y <em>resérvala</em> por horas.
            </h1>
            <p className={styles.lead}>
              Recorre el edificio planta a planta, ve el precio y la capacidad de cada sala y paga
              online. Sin llamadas ni presupuestos: eliges las horas y listo.
            </p>
            <ul className={styles.perks}>
              <li>Salas libres en el plano</li>
              <li>Precio claro por hora</li>
              <li>Pago online</li>
            </ul>
          </div>

          <div className={styles.heroBuilding}>
            <HeroStory buildingId={BUILDING.id} buildingName={BUILDING.name} />
          </div>

          <SearchBar
            variant="hero"
            className={styles.search}
            submitLabel="Buscar salas"
            onSearch={handleSearch}
          />
        </div>
      </section>

      {/* Ritmo de superficies: hero oscuro, cómo funciona claro, planta oscura, salas claras, alrededor oscuro y banda albero. */}
      <HowItWorks />
      <FloorSection buildingName={BUILDING.name} />

      <Section id="salas" titleId="salas-titulo" tone="papel" bordered={false}>
        <div className={styles.roomsHead}>
          <SectionTitle id="salas-titulo">
            Salas <em>destacadas</em>
          </SectionTitle>
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

      <NearbySection />
      <CompaniesCta />
    </div>
  );
}
