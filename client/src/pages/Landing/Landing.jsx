// Home: hero con el edificio por plantas, buscador, salas destacadas, cómo funciona y llamada a empresas.
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { BUILDING as NEARBY_BUILDING } from '@/config/nearby.js';
import pois from '@/data/poi.json';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import RoomCard from '@/components/room/RoomCard/RoomCard.jsx';
import SearchBar from '@/components/search/SearchBar/SearchBar.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import EmptyState from '@/components/ui/EmptyState/EmptyState.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import Section from '@/components/ui/Section/Section.jsx';
import SectionTitle from '@/components/ui/SectionTitle/SectionTitle.jsx';
import { createProgressStore } from '@/utils/progressStore.js';
import BuildingBackdrop from './BuildingStamps/BuildingBackdrop/BuildingBackdrop.jsx';
import BuildingStamps from './BuildingStamps/BuildingStamps.jsx';
import CompaniesCta from './CompaniesCta/CompaniesCta.jsx';
import { getFeaturedRooms } from '@/services/roomsService.js';
import { TYPE_LABELS } from '@/utils/roomData.js';
import { BUILDING, DEMO_FEATURED_ROOMS, ROOM_FILTERS } from './data.js';
import FloorSection from './FloorSection/FloorSection.jsx';
import HowItWorks from './HowItWorks/HowItWorks.jsx';
import styles from './Landing.module.css';
import LandingLoader from './LandingLoader/LandingLoader.jsx';
import { heroEntranceDelay } from './loaderSession.js';
import NearbySection from './NearbySection/NearbySection.jsx';
import CategoryFilters from '@/components/search/CategoryFilters/CategoryFilters.jsx';

// Edificio de demostración de «Alrededor»: la sección ya no lee la config, se lo pasa la página.
const NEARBY_DEMO = {
  nombre: NEARBY_BUILDING.name,
  latitud: NEARBY_BUILDING.lat,
  longitud: NEARBY_BUILDING.lng,
  huella: NEARBY_BUILDING.footprint,
};

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
  const [filter, setFilter] = useState(ROOM_FILTERS[0].label);

  // Salas destacadas de la API. Solo en desarrollo, si la API no responde, se ven las de ejemplo.
  const featured = useFetch((signal) => getFeaturedRooms({ signal }), 'destacadas');
  const isDemo = import.meta.env.DEV && Boolean(featured.error);
  const allRooms = (featured.data ?? (isDemo ? DEMO_FEATURED_ROOMS : [])).map(toCard);
  const tipo = ROOM_FILTERS.find((f) => f.label === filter)?.tipo;
  const rooms = tipo ? allRooms.filter((r) => r.tipo === tipo) : allRooms;
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

      {/* Ritmo de superficies: hero oscuro, cómo funciona claro, planta oscura, salas claras, alrededor oscuro y banda albero. */}
      <HowItWorks />
      <FloorSection buildingName={BUILDING.name} />

      <Section id="salas" titleId="salas-titulo" tone="papel" bordered={false}>
        <div className={styles.roomsHead}>
          <SectionTitle id="salas-titulo">
            Salas <em>destacadas</em>
          </SectionTitle>
          <CategoryFilters
            filters={ROOM_FILTERS.map((f) => f.label)}
            active={filter}
            onChange={setFilter}
          />
        </div>
        {featured.loading ? (
          <div className={styles.empty}>
            <Spinner label="Cargando salas…" />
          </div>
        ) : featured.error && !isDemo ? (
          <div className={styles.empty} role="status">
            <EmptyState
              title="No hemos podido cargar las salas."
              text="Inténtalo de nuevo en un momento."
              actions={
                <Button variant="dark" onClick={featured.reload}>
                  Reintentar
                </Button>
              }
            />
          </div>
        ) : rooms.length > 0 ? (
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
            <EmptyState
              title={
                allRooms.length > 0
                  ? 'No hay salas de este tipo todavía.'
                  : 'Todavía no hay salas publicadas.'
              }
              text={allRooms.length > 0 ? 'Prueba con otro filtro.' : 'Vuelve pronto.'}
            />
          </div>
        )}
      </Section>

      <NearbySection edificio={NEARBY_DEMO} pois={pois} />
      <CompaniesCta />
    </div>
  );
}

// Sala de getFeaturedRooms → props de RoomCard.
function toCard(sala) {
  return {
    id: sala.id,
    tipo: sala.tipo,
    name: sala.nombre,
    type: TYPE_LABELS[sala.tipo] ?? 'Sala',
    place: [sala.edificio, sala.ciudad].filter(Boolean).join(', '),
    people: sala.capacidad,
    price: sala.precioHora,
    gratis: sala.gratis,
  };
}
