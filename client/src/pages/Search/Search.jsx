// Resultados de búsqueda: edificios con salas libres según ciudad, fecha y personas, con filtros de tipo, precio y orden.
// Todos los filtros viven en la URL (se puede compartir o recargar). El servidor filtra y ordena; aquí solo se pintan.
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import BuildingCard from '@/components/search/BuildingCard/BuildingCard.jsx';
import CategoryFilters from '@/components/search/CategoryFilters/CategoryFilters.jsx';
import SearchBar from '@/components/search/SearchBar/SearchBar.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import EmptyState from '@/components/ui/EmptyState/EmptyState.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import Select from '@/components/ui/Select/Select.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { BUILDING } from '@/pages/Landing/data.js';
import { getBuildings } from '@/services/buildingsService.js';
import styles from './Search.module.css';

const PAGE_SIZE = 6;
const MAX_LIMIT = 50; // máximo que acepta la API por petición

// La API distingue salas y boxes; las etiquetas son las del filtro de la pantalla.
const TYPES = [
  { label: 'Todas', value: '' },
  { label: 'Salas', value: 'sala' },
  { label: 'Boxes privados', value: 'box' },
];
const TYPE_LABELS = TYPES.map((type) => type.label);

// Sin tildes ni mayúsculas: «sevilla» encuentra «Sevilla». Solo para los datos de ejemplo.
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
    direccion: '',
    ciudad: BUILDING.city,
    foto: null,
  },
];

// Sin API (sin red, 404 o error 5xx) se pasa a datos de ejemplo; el resto de 4xx (p. ej. un 400) es un error de verdad.
const isUnavailable = (error) =>
  Boolean(error) && (!error.status || error.status === 404 || error.status >= 500);

export default function Search() {
  usePageTitle('Buscar salas');
  const [searchParams, setSearchParams] = useSearchParams();
  const barRef = useRef(null);
  const city = searchParams.get('city') ?? '';
  const date = searchParams.get('date') ?? '';
  const people = searchParams.get('people') ?? '';
  const tipo = searchParams.get('tipo') ?? '';
  const precioMax = searchParams.get('precioMax') ?? '';
  const orden = searchParams.get('orden') ?? '';

  // «Ver más» pide más resultados de una vez (limit); al cambiar cualquier filtro se vuelve a la primera tanda.
  const filtersKey = searchParams.toString();
  const [more, setMore] = useState({ key: filtersKey, batches: 1 });
  const batches = more.key === filtersKey ? more.batches : 1;
  const limit = Math.min(PAGE_SIZE * batches, MAX_LIMIT);

  const { data, error, loading, reload } = useFetch(
    (signal) =>
      getBuildings({
        ciudad: city,
        fecha: date,
        personas: people,
        tipo,
        precioMax,
        orden,
        page: 1,
        limit,
        signal,
      }),
    `${filtersKey}|${limit}`,
  );

  // Mientras llega una tanda nueva se siguen viendo los resultados anteriores (sin saltos al pulsar «Ver más»).
  const [previous, setPrevious] = useState(null);
  if (data && data !== previous) setPrevious(data);
  const shown = data ?? previous;

  const isDemo = isUnavailable(error);
  let buildings = shown?.edificios ?? [];
  let total = shown?.total ?? 0;
  if (isDemo) {
    const needle = normalize(city);
    buildings = DEMO_BUILDINGS.filter(
      (b) => !needle || normalize(`${b.nombre} ${b.ciudad}`).includes(needle),
    );
    total = buildings.length;
  }

  function change(changes) {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSearchParams(next);
  }

  function handleSearch(values) {
    change({ city: values.city, date: values.date, people: values.people });
  }

  function handlePrice(value) {
    const amount = Number(value);
    change({ precioMax: Number.isFinite(amount) && amount >= 1 ? String(Math.floor(amount)) : '' });
  }

  function focusDate() {
    barRef.current?.querySelector('input[name="date"]')?.focus();
  }

  const hasFilters = Boolean(city || date || people || tipo || precioMax || orden);
  const activeType = TYPES.find((type) => type.value === tipo)?.label ?? TYPES[0].label;

  let results;
  if (loading && !shown) {
    results = <Spinner label="Buscando edificios…" />;
  } else if (error && !isDemo) {
    results = (
      <ErrorState error={error} home onRetry={reload}>
        {error.message}
      </ErrorState>
    );
  } else if (buildings.length === 0) {
    results = (
      <EmptyState
        title="No hay salas libres con esos filtros"
        actions={
          <>
            <Button variant="secondary" onClick={focusDate}>
              Cambiar la fecha
            </Button>
            {hasFilters && (
              <Button variant="secondary" onClick={() => setSearchParams({})}>
                Quitar filtros
              </Button>
            )}
          </>
        }
      >
        Prueba con otra fecha, otra ciudad o menos personas.
      </EmptyState>
    );
  } else {
    results = (
      <>
        <h2 className={styles.count} role="status">
          {total} {total === 1 ? 'edificio' : 'edificios'} con salas libres
          {city ? ` en ${city}` : ''}
        </h2>
        <ul className={styles.grid} aria-busy={loading}>
          {buildings.map((building) => (
            <li key={building.id}>
              <BuildingCard building={building} date={date} people={people} />
            </li>
          ))}
        </ul>
        {!isDemo && buildings.length < total && limit < MAX_LIMIT && (
          <div className={styles.more}>
            <Button
              variant="secondary"
              loading={loading}
              onClick={() => setMore({ key: filtersKey, batches: batches + 1 })}
            >
              Ver más edificios
            </Button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.title}>Encuentra tu sala</h1>
        <div ref={barRef}>
          <SearchBar city={city} date={date} people={people} onSearch={handleSearch} />
        </div>

        <div className={styles.filters}>
          <CategoryFilters
            filters={TYPE_LABELS}
            active={activeType}
            onChange={(label) => change({ tipo: TYPES.find((t) => t.label === label)?.value })}
          />
          <div className={styles.filterFields}>
            <Input
              key={`precio-${precioMax}`}
              label="Precio máximo (€/h)"
              name="precioMax"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder="Sin límite"
              defaultValue={precioMax}
              onBlur={(event) => handlePrice(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handlePrice(event.currentTarget.value);
                }
              }}
            />
            <Select
              label="Ordenar por"
              name="orden"
              value={orden || 'precio'}
              onChange={(event) =>
                change({ orden: event.target.value === 'precio' ? '' : event.target.value })
              }
            >
              <option value="precio">Precio más bajo</option>
              <option value="salas">Más salas libres</option>
            </Select>
          </div>
        </div>

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
