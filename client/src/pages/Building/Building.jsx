// Página de un edificio: cabecera con la fecha, plantas con sus salas libres y «Qué hay cerca».
import { useMemo, useState } from 'react';
import { Link, useSearchParams, useParams } from 'react-router';
import BuildingHero from '@/components/building/BuildingHero/BuildingHero.jsx';
import FloorList from '@/components/building/FloorList/FloorList.jsx';
import FloorSelector from '@/components/building/FloorSelector/FloorSelector.jsx';
import Breadcrumbs from '@/components/ui/Breadcrumbs/Breadcrumbs.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import Section from '@/components/ui/Section/Section.jsx';
import SectionTitle from '@/components/ui/SectionTitle/SectionTitle.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import NearbySection from '@/pages/Landing/NearbySection/NearbySection.jsx';
import { BUILDING } from '@/pages/Landing/data.js';
import { FLOORS_HERO } from '@/pages/Landing/heroBuildingData.js';
import { getBuilding } from '@/services/buildingsService.js';
import { formatLongDate, todayString } from '@/utils/dates.js';
import styles from './Building.module.css';

// Edificio de ejemplo de la landing: si la API no responde, se enseña con datos de muestra.
function demoBuilding() {
  const plantas = FLOORS_HERO.filter((floor) => !floor.off).map((floor) => ({
    id: floor.id,
    nombre: floor.name,
    nivel: floor.number,
    salasLibres: floor.free,
    totalSalas: floor.total,
  }));
  return {
    id: BUILDING.id,
    nombre: BUILDING.name,
    descripcion: 'Un edificio de oficinas con salas por horas en cada planta.',
    direccion: '',
    ciudad: BUILDING.city,
    numPlantas: plantas.length,
    plantas,
    salasLibres: plantas.reduce((sum, planta) => sum + planta.salasLibres, 0),
  };
}

// Ilustración decorativa de la cabecera: una losa isométrica por planta (hasta 8), apiladas. Solo adorna.
function FloorsArt({ count }) {
  const floors = Math.min(Math.max(count, 1), 8);
  const step = 52;
  const halfW = 150;
  const halfH = 62;
  const thick = 10;
  const height = (floors - 1) * step + halfH * 2 + thick + 8;
  const cx = halfW + 4;
  const slabs = Array.from({ length: floors }, (_, i) => {
    // La planta más baja se dibuja primero y las de arriba la tapan.
    const y = halfH + 4 + (floors - 1 - i) * step;
    return { i, y, top: i === floors - 1 };
  });

  return (
    <svg
      className={styles.art}
      viewBox={`0 0 ${halfW * 2 + 8} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      {slabs.map(({ i, y, top }) => (
        <g key={i} className={styles.slab} style={{ '--i': floors - 1 - i }}>
          <polygon
            className={styles.slabSide}
            points={`${cx - halfW},${y} ${cx},${y + halfH} ${cx},${y + halfH + thick} ${cx - halfW},${y + thick}`}
          />
          <polygon
            className={styles.slabSideDark}
            points={`${cx + halfW},${y} ${cx},${y + halfH} ${cx},${y + halfH + thick} ${cx + halfW},${y + thick}`}
          />
          <polygon
            className={top ? styles.slabTopHigh : styles.slabTop}
            points={`${cx},${y - halfH} ${cx + halfW},${y} ${cx},${y + halfH} ${cx - halfW},${y}`}
          />
        </g>
      ))}
    </svg>
  );
}

export default function Building() {
  const { buildingId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const fecha = searchParams.get('date') || todayString();
  const people = searchParams.get('people') ?? '';
  const [activeId, setActiveId] = useState('');
  const { data, error, loading, reload } = useFetch(
    (signal) => getBuilding(buildingId, { fecha, signal }),
    `${buildingId}|${fecha}`,
  );

  // Solo en desarrollo y sin API se ve el edificio de ejemplo; en producción, el error.
  const isDemo = import.meta.env.DEV && Boolean(error) && buildingId === BUILDING.id;
  const building = isDemo ? demoBuilding() : data;
  usePageTitle(building?.nombre ?? 'Edificio');

  // Plantas de la más alta a la más baja, con la forma que usan el edificio 3D y el selector.
  const heroFloors = useMemo(
    () =>
      [...(building?.plantas ?? [])]
        .sort((a, b) => b.nivel - a.nivel)
        .map((planta) => ({
          id: planta.id,
          name: planta.nombre,
          number: planta.nivel,
          free: planta.salasLibres,
          total: planta.totalSalas,
          rooms: [
            ...Array(planta.salasLibres).fill('free'),
            ...Array(
              Math.max(0, (planta.totalSalas ?? planta.salasLibres) - planta.salasLibres),
            ).fill('busy'),
          ],
        })),
    [building],
  );

  function handleDateChange(event) {
    const next = event.target.value;
    setSearchParams(next ? { date: next } : {}, { replace: true });
  }

  if (loading) {
    return (
      <div className={styles.status}>
        <Spinner label="Cargando el edificio…" />
      </div>
    );
  }

  if (error && !isDemo) {
    const notFound = error.status === 404;
    return (
      <div className={styles.status}>
        <ErrorState
          error={error}
          home
          page
          code={notFound ? '404' : undefined}
          title={notFound ? 'No encontramos este edificio' : undefined}
          onRetry={notFound ? undefined : reload}
        >
          {notFound
            ? 'Puede que ya no esté publicado o que el enlace sea incorrecto.'
            : error.message}
        </ErrorState>
      </div>
    );
  }

  const where = [building.direccion, building.ciudad].filter(Boolean).join(', ');
  const crumbs = [
    { label: 'Inicio', to: '/' },
    ...(building.ciudad
      ? [{ label: building.ciudad, to: `/search?city=${encodeURIComponent(building.ciudad)}` }]
      : []),
    { label: building.nombre },
  ];
  const activeFloor = heroFloors.find((floor) => floor.id === activeId) ?? heroFloors[0];
  const planQuery = new URLSearchParams({ date: fecha, ...(people ? { people } : {}) }).toString();

  return (
    <div className={styles.page}>
      <header className={styles.hero} aria-labelledby="edificio-titulo" data-superficie="clara">
        <div className={styles.aurora} aria-hidden="true">
          <span className={styles.blobA} />
          <span className={styles.blobB} />
          <span className={styles.blobC} />
        </div>
        <div className={styles.heroInner}>
          <FloorsArt count={building.plantas.length} />
          <Breadcrumbs items={crumbs} />
          <p className={styles.eyebrow}>{building.ciudad || 'Edificio'}</p>
          <h1 className={styles.title} id="edificio-titulo">
            {building.nombre}
          </h1>
          {where && <p className={styles.address}>{where}</p>}
          {building.descripcion && <p className={styles.lead}>{building.descripcion}</p>}

          <div className={styles.meta}>
            <dl className={styles.stats}>
              <div className={styles.stat}>
                <dt>Plantas</dt>
                <dd>{building.plantas.length}</dd>
              </div>
              <div className={styles.stat}>
                <dt>Salas libres</dt>
                <dd>{building.salasLibres}</dd>
              </div>
            </dl>

            <div className={styles.date}>
              <Input
                label="Fecha"
                type="date"
                name="date"
                variant="boxed"
                value={fecha}
                min={todayString()}
                onChange={handleDateChange}
                hint={formatLongDate(fecha)}
              />
            </div>
          </div>
          {isDemo && (
            <p className={styles.note} role="note">
              Estás viendo datos de ejemplo: la API no está disponible.
            </p>
          )}
        </div>
      </header>

      <Section id="plantas" titleId="plantas-titulo" tone="deep" decor="grid" spacious>
        <SectionTitle id="plantas-titulo">Elige una planta</SectionTitle>
        <p className={styles.sectionLead}>
          Entra en una planta para ver su plano y sus salas libres en la fecha elegida.
        </p>
        {heroFloors.length > 0 && (
          <div className={styles.explorer}>
            <BuildingHero
              buildingId={building.id}
              buildingName={building.nombre}
              floors={heroFloors}
              activeFloorId={activeFloor.id}
              onSelectFloor={setActiveId}
              showInfo={false}
              showFloorList={false}
            />
            <div className={styles.picker}>
              <FloorSelector
                floors={heroFloors}
                activeFloorId={activeFloor.id}
                onSelect={setActiveId}
                label={`Plantas del ${building.nombre}`}
                orientation="vertical"
              />
              <div className={styles.summary} aria-live="polite">
                <p className={styles.summaryTitle}>{activeFloor.name}</p>
                <p className={styles.summaryText}>
                  {activeFloor.free === 0
                    ? 'Sin salas libres.'
                    : `${activeFloor.free} ${activeFloor.free === 1 ? 'sala libre' : 'salas libres'}.`}
                </p>
                <Link
                  className={styles.summaryLink}
                  to={`/buildings/${building.id}/floors/${activeFloor.id}?${planQuery}`}
                >
                  Ver plano
                </Link>
              </div>
            </div>
          </div>
        )}
        {/* La lista repite el selector: solo se enseña donde no cabe el selector junto al 3D (móvil y tablet). */}
        <div className={styles.allFloors}>
          <h3 className={styles.listTitle}>Todas las plantas</h3>
          <FloorList
            buildingId={building.id}
            floors={building.plantas}
            fecha={fecha}
            people={people}
          />
        </div>
      </Section>

      <NearbySection tone="crema" />
    </div>
  );
}
