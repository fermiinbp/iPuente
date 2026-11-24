// Ubicación del edificio (EMP018): buscador de direcciones (Nominatim), mapa con un pin que se mueve con un clic y
// campos de latitud y longitud, que son la alternativa accesible al mapa. Controlado: `value` es
// { latitud, longitud } o null y `onChange` recibe siempre una ubicación completa y válida, o null.
// Mientras los campos estén a medias o fuera de rango no se llama a `onChange`: se avisa con
// `onValidityChange(false)` (y `true` al volver a ser válidos) para que la página no guarde coordenadas a medias.
// Se importa con React.lazy desde BuildingForm para no meter MapLibre en el bundle del panel.
import 'maplibre-gl/dist/maplibre-gl.css';
import '@/config/maplibre.js';
import { useEffect, useRef, useState } from 'react';
import MapGL, { Marker } from 'react-map-gl/maplibre';
import { loadBosqueStyle } from '@/components/building/NearbyMap/mapStyle.js';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { searchAddress } from '@/services/geocodingService.js';
import styles from './LocationPicker.module.css';

const REDUCED = '(prefers-reduced-motion: reduce)';
const SPAIN_VIEW = { longitude: -5.99, latitude: 37.39, zoom: 5 };
const PIN_ZOOM = 17;

const round6 = (n) => Math.round(n * 1e6) / 1e6;
const toText = (n) => (Number.isFinite(n) ? String(n) : '');

// Errores de los campos a partir de su texto. `parsed` es la ubicación si es completa y válida.
function check(latText, lngText) {
  const lat = latText.trim();
  const lng = lngText.trim();
  if (!lat && !lng) return { empty: true, errors: {}, parsed: null };
  const errors = {};
  const latNum = lat ? Number(lat) : NaN;
  const lngNum = lng ? Number(lng) : NaN;
  if (!lat) errors.latitud = 'Escribe también la latitud.';
  else if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90)
    errors.latitud = 'La latitud debe estar entre -90 y 90.';
  if (!lng) errors.longitud = 'Escribe también la longitud.';
  else if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180)
    errors.longitud = 'La longitud debe estar entre -180 y 180.';
  const valid = Object.keys(errors).length === 0;
  return { empty: false, errors, parsed: valid ? { latitud: latNum, longitud: lngNum } : null };
}

// El mapa es decorativo (aria-hidden): nada dentro debe recibir el foco con Tab. Los campos de latitud y longitud
// son el equivalente accesible. El canvas y los enlaces de atribución los crea MapLibre, así que se quitan del tabulado.
function removeFromTabOrder(map) {
  const container = map?.getContainer?.();
  if (!container) return;
  container.querySelectorAll('canvas, a, button, [tabindex]').forEach((el) => {
    if (el.getAttribute('tabindex') !== '-1') el.setAttribute('tabindex', '-1');
  });
}

const hasValue = (v) => v && Number.isFinite(v.latitud) && Number.isFinite(v.longitud);

export default function LocationPicker({
  value,
  onChange,
  onValidityChange,
  initialQuery = '',
  error,
}) {
  const mapRef = useRef(null);
  const abortRef = useRef(null);
  const skipCenterRef = useRef(false);
  const [style, setStyle] = useState(null);
  const [mapFailed, setMapFailed] = useState(false);

  const [query, setQuery] = useState(initialQuery);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [chosen, setChosen] = useState('');

  const [latText, setLatText] = useState(toText(value?.latitud));
  const [lngText, setLngText] = useState(toText(value?.longitud));
  const [seen, setSeen] = useState(value);

  // Si el valor cambia desde fuera (mapa, resultado, quitar), los campos lo reflejan. Si cambia porque se está
  // escribiendo en ellos (el texto ya vale lo mismo), no se pisa lo escrito.
  if (value !== seen) {
    setSeen(value);
    const typed = check(latText, lngText).parsed;
    const same = hasValue(value)
      ? typed && typed.latitud === value.latitud && typed.longitud === value.longitud
      : !value && !latText.trim() && !lngText.trim();
    if (!same) {
      setLatText(toText(value?.latitud));
      setLngText(toText(value?.longitud));
    }
  }
  const { errors: fieldErrors } = check(latText, lngText);

  useEffect(() => {
    let alive = true;
    loadBosqueStyle()
      .then((loaded) => alive && setStyle(loaded))
      .catch(() => alive && setMapFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Centra el pin cuando el valor cambia desde los campos (si cambió por el mapa, ya está a la vista).
  useEffect(() => {
    if (skipCenterRef.current) {
      skipCenterRef.current = false;
      return;
    }
    const map = mapRef.current;
    if (!map || !hasValue(value)) return;
    const duration = window.matchMedia(REDUCED).matches ? 0 : 500;
    map.easeTo({ center: [value.longitud, value.latitud], duration });
  }, [value]);

  const emit = (next) => {
    onChange(next);
    onValidityChange?.(true);
  };

  const place = (latitud, longitud) => {
    skipCenterRef.current = true;
    setLatText(String(latitud));
    setLngText(String(longitud));
    setSeen({ latitud, longitud });
    emit({ latitud, longitud });
  };

  const onFieldChange = (field) => (event) => {
    const nextLat = field === 'latitud' ? event.target.value : latText;
    const nextLng = field === 'longitud' ? event.target.value : lngText;
    if (field === 'latitud') setLatText(nextLat);
    else setLngText(nextLng);
    const result = check(nextLat, nextLng);
    if (result.empty) {
      setSeen(null);
      emit(null);
    } else if (result.parsed) {
      setSeen(result.parsed);
      emit(result.parsed);
    } else {
      onValidityChange?.(false);
    }
  };

  const clear = () => {
    setLatText('');
    setLngText('');
    setSeen(null);
    setChosen('');
    emit(null);
  };

  const runSearch = async () => {
    const text = query.trim();
    if (!text) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    setSearchError(null);
    setResults(null);
    setChosen('');
    try {
      const found = await searchAddress(text, { signal: controller.signal });
      setResults(found);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setSearchError(err.message);
    } finally {
      if (abortRef.current === controller) setSearching(false);
    }
  };

  const choose = (item) => {
    const latitud = round6(item.latitud);
    const longitud = round6(item.longitud);
    setResults(null);
    setChosen(`Ubicación elegida: ${item.etiqueta}`);
    place(latitud, longitud);
    const duration = window.matchMedia(REDUCED).matches ? 0 : 1200;
    mapRef.current?.flyTo({ center: [longitud, latitud], zoom: PIN_ZOOM, duration });
  };

  const onQueryKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    // Está dentro del formulario del edificio: Enter busca, no guarda.
    event.preventDefault();
    runSearch();
  };

  const initialView = hasValue(value)
    ? { longitude: value.longitud, latitude: value.latitud, zoom: PIN_ZOOM - 2 }
    : SPAIN_VIEW;

  return (
    <div className={styles.picker}>
      <div className={styles.search}>
        <Input
          className={styles.searchInput}
          variant="boxed"
          label="Dirección"
          value={query}
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onQueryKeyDown}
        />
        <Button
          type="button"
          variant="secondary"
          size="md"
          loading={searching}
          disabled={!query.trim()}
          onClick={runSearch}
        >
          Buscar
        </Button>
      </div>
      <p className={styles.notice}>
        La búsqueda usa OpenStreetMap: la dirección que escribas se envía a su servicio. ©
        OpenStreetMap
      </p>

      <div aria-live="polite" className={styles.live}>
        {chosen && <p className={styles.chosen}>{chosen}</p>}
        {results && results.length === 0 && (
          <p className={styles.empty}>
            Sin resultados. Prueba con otra dirección o sitúalo en el mapa.
          </p>
        )}
      </div>
      {searchError && <Alert type="error">{searchError}</Alert>}
      {results && results.length > 0 && (
        <ul className={styles.results} aria-label="Resultados de la búsqueda">
          {results.map((item) => (
            <li key={`${item.latitud},${item.longitud},${item.etiqueta}`}>
              <button type="button" className={styles.result} onClick={() => choose(item)}>
                {item.etiqueta}
              </button>
            </li>
          ))}
        </ul>
      )}

      {mapFailed ? (
        <Alert type="warning">
          El mapa no se ha podido cargar. Escribe las coordenadas en los campos de abajo.
        </Alert>
      ) : (
        <div className={styles.map} aria-hidden="true">
          {!style ? (
            <Spinner label="Cargando el mapa…" />
          ) : (
            <MapGL
              ref={mapRef}
              mapStyle={style}
              initialViewState={initialView}
              cooperativeGestures
              keyboard={false}
              attributionControl={{ compact: true }}
              onLoad={() => {
                if (!mapRef.current) return;
                mapRef.current.resize();
                removeFromTabOrder(mapRef.current);
              }}
              onIdle={() => removeFromTabOrder(mapRef.current)}
              onClick={(event) => place(round6(event.lngLat.lat), round6(event.lngLat.lng))}
            >
              {hasValue(value) && (
                <Marker longitude={value.longitud} latitude={value.latitud} anchor="bottom">
                  <span className={styles.pin} />
                </Marker>
              )}
            </MapGL>
          )}
        </div>
      )}
      <p className={styles.notice}>
        Haz clic en el mapa para situar el edificio, o escribe las coordenadas.
      </p>

      <div className={styles.coords}>
        <Input
          variant="boxed"
          type="number"
          label="Latitud"
          step="any"
          min={-90}
          max={90}
          value={latText}
          error={fieldErrors.latitud}
          onChange={onFieldChange('latitud')}
        />
        <Input
          variant="boxed"
          type="number"
          label="Longitud"
          step="any"
          min={-180}
          max={180}
          value={lngText}
          error={fieldErrors.longitud}
          onChange={onFieldChange('longitud')}
        />
      </div>
      {error && !fieldErrors.latitud && !fieldErrors.longitud && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {hasValue(value) && (
        <div>
          <Button type="button" variant="ghost" size="md" onClick={clear}>
            Quitar ubicación
          </Button>
        </div>
      )}
    </div>
  );
}
