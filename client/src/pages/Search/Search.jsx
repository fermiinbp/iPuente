// Resultados de búsqueda: edificios publicados filtrados por ciudad o nombre; la fecha se lleva al edificio.
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import BuildingCard from '@/components/search/BuildingCard/BuildingCard.jsx';
import SearchBar from '@/components/search/SearchBar/SearchBar.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import EmptyState from '@/components/ui/EmptyState/EmptyState.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { BUILDING } from '@/pages/Landing/data.js';
import { getBuildings } from '@/services/buildingsService.js';
import styles from './Search.module.css';

// Sin tildes ni mayúsculas: «sevilla» encuentra «Sevilla» y «Málaga» se encuentra con «malaga».
const normalize = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Edificio de ejemplo de la landing: si la API no responde, se enseña con datos de muestra.
const DEMO_BUILDINGS = [
  {
    id: BUILDING.id,
    nombre: BUILDING.name,
    descripcion: 'Un edificio de oficinas con salas por horas en cada planta.',
    direccion: '',
    ciudad: BUILDING.city,
    numPlantas: 6,
  },
];

export default function Search() {
  usePageTitle('Buscar salas');
  const [searchParams, setSearchParams] = useSearchParams();
  const city = searchParams.get('city') ?? '';
  const date = searchParams.get('date') ?? '';
  const { data, error, loading, reload } = useFetch((signal) => getBuildings({ signal }), 'all');

  const isDemo = Boolean(error);
  const buildings = useMemo(() => {
    const all = isDemo ? DEMO_BUILDINGS : (data ?? []);
    const needle = normalize(city);
    if (!needle) return all;
    return all.filter((b) => normalize(`${b.nombre} ${b.ciudad} ${b.direccion}`).includes(needle));
  }, [data, isDemo, city]);

  function handleSearch(next) {
    const params = {};
    if (next.city) params.city = next.city;
    if (next.date) params.date = next.date;
    setSearchParams(params);
  }

  let results;
  if (loading) {
    results = <Spinner label="Buscando edificios…" />;
  } else if (error && !isDemo) {
    results = <ErrorState onRetry={reload}>{error.message}</ErrorState>;
  } else if (buildings.length === 0) {
    results = (
      <EmptyState
        title="No hay edificios que coincidan"
        action={
          <Button variant="secondary" onClick={() => setSearchParams({})}>
            Ver todos los edificios
          </Button>
        }
      >
        Prueba con otra ciudad o con el nombre del edificio.
      </EmptyState>
    );
  } else {
    results = (
      <>
        <p className={styles.count} role="status">
          {buildings.length} {buildings.length === 1 ? 'edificio' : 'edificios'}
          {city ? ` para «${city}»` : ''}
        </p>
        <ul className={styles.grid}>
          {buildings.map((building) => (
            <li key={building.id}>
              <BuildingCard building={building} date={date} />
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.title}>Encuentra tu sala</h1>
        <SearchBar city={city} date={date} onSearch={handleSearch} />
        {isDemo && (
          <p className={styles.demoNote} role="note">
            Estás viendo datos de ejemplo: la API no está disponible.
          </p>
        )}
        {results}
      </div>
    </div>
  );
}
