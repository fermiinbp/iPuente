// Mapa vectorial «Alrededor del edificio»: calles y edificios 3D (MapLibre + OpenFreeMap, sin API key).
// El edificio iPuente destaca en bronce. Al elegir un lugar la cámara vuela hasta él y se dibuja su ruta.
// Se importa con React.lazy desde NearbySection.
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import MapGL, { Layer, Marker, Source } from 'react-map-gl/maplibre';
import { VIEW } from '@/config/nearby.js';
import PoiMarker from './PoiMarker/PoiMarker.jsx';
import { loadBosqueStyle, readMapColors } from './mapStyle.js';
import styles from './NearbyMap.module.css';

const MOBILE = '(max-width: 599px)';
const REDUCED = '(prefers-reduced-motion: reduce)';

// Mensajes del modo «gestos cooperativos» (móvil), en español.
const LOCALE = {
  'CooperativeGesturesHandler.WindowsHelpText': 'Usa Ctrl + rueda para mover el mapa',
  'CooperativeGesturesHandler.MacHelpText': 'Usa ⌘ + rueda para mover el mapa',
  'CooperativeGesturesHandler.MobileHelpText': 'Usa dos dedos para mover el mapa',
};

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const line = (coordinates) => ({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates },
  properties: {},
});

// Huella del edificio como polígono GeoJSON. Sin huella propia (anillo de 4 puntos o más) no se dibuja:
// el edificio queda marcado solo con su `Marker`.
function huellaGeoJson(huella) {
  if (!Array.isArray(huella) || huella.length < 4) return null;
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [huella] },
    properties: {},
  };
}

function boundsOf(puntos) {
  const lngs = puntos.map((p) => p[0]);
  const lats = puntos.map((p) => p[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

// `edificio`: { nombre, latitud, longitud, huella?, altura? }. `huella` es un anillo cerrado de puntos
// [lng, lat]; `altura` son los metros de la extrusión (por defecto, `VIEW.alturaEdificio`).
export default function NearbyMap({
  edificio,
  pois,
  activeId,
  hoverId,
  onSelect,
  onHover,
  onReset,
  onUnavailable,
}) {
  const mapRef = useRef(null);
  const previoActivo = useRef(activeId);
  const [style, setStyle] = useState(null);
  const [mobile] = useState(() => window.matchMedia(MOBILE).matches);
  const c = useMemo(() => readMapColors(), []);
  const active = pois.find((poi) => poi.id === activeId) ?? null;
  const { nombre, latitud, longitud, huella, altura = VIEW.alturaEdificio } = edificio;
  const footprint = useMemo(() => huellaGeoJson(huella), [huella]);

  useEffect(() => {
    let vivo = true;
    loadBosqueStyle()
      .then((estilo) => vivo && setStyle(estilo))
      .catch(() => vivo && onUnavailable?.());
    return () => {
      vivo = false;
    };
  }, [onUnavailable]);

  // La cámara solo se mueve cuando cambia el lugar elegido. Con movimiento reducido, el cambio es instantáneo.
  useEffect(() => {
    if (previoActivo.current === activeId) return;
    previoActivo.current = activeId;
    const map = mapRef.current;
    if (!map) return;
    const pitch = mobile ? VIEW.pitchMobile : VIEW.pitch;
    const duration = window.matchMedia(REDUCED).matches ? 0 : VIEW.flyMs;
    if (!active) {
      map.flyTo({
        center: [longitud, latitud],
        zoom: VIEW.zoom,
        pitch,
        bearing: VIEW.bearing,
        duration,
        easing: easeInOut,
      });
      return;
    }
    // Encuadra el recorrido entero: así la ruta se ve de principio a fin.
    map.fitBounds(boundsOf(active.ruta), {
      padding: mobile ? 50 : 90,
      maxZoom: VIEW.poiZoomMax,
      pitch,
      bearing: VIEW.bearing,
      duration,
      easing: easeInOut,
    });
  }, [activeId, active, mobile, latitud, longitud]);

  const habilitarRueda = () => mapRef.current?.scrollZoom.enable();
  const deshabilitarRueda = () => mapRef.current?.scrollZoom.disable();

  if (!style) return <p className={styles.note}>Cargando el mapa…</p>;

  return (
    <div
      className={styles.wrap}
      role="region"
      aria-label={`Mapa de los alrededores de ${nombre}`}
      onMouseLeave={deshabilitarRueda}
    >
      <MapGL
        ref={mapRef}
        mapStyle={style}
        initialViewState={{
          longitude: longitud,
          latitude: latitud,
          zoom: VIEW.zoom,
          pitch: mobile ? VIEW.pitchMobile : VIEW.pitch,
          bearing: VIEW.bearing,
        }}
        maxPitch={70}
        scrollZoom={false}
        cooperativeGestures={mobile}
        locale={LOCALE}
        attributionControl={{ compact: false }}
        onClick={habilitarRueda}
        onError={(evento) => console.error('[NearbyMap]', evento.error?.message ?? evento)}
        style={{ width: '100%', height: '100%' }}
      >
        <Layer
          id="edificios-3d"
          type="fill-extrusion"
          source="openmaptiles"
          source-layer="building"
          minzoom={14}
          paint={{
            'fill-extrusion-color': c['bosque-elevado'],
            'fill-extrusion-opacity': 0.85,
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          }}
        />

        {footprint && (
          <Source id="ipuente" type="geojson" data={footprint}>
            <Layer
              id="ipuente-halo"
              type="line"
              paint={{
                'line-color': c['bronce-claro'],
                'line-width': 14,
                'line-blur': 10,
                'line-opacity': 0.55,
              }}
            />
            <Layer
              id="ipuente-3d"
              type="fill-extrusion"
              paint={{
                'fill-extrusion-color': c.bronce,
                'fill-extrusion-opacity': 1,
                'fill-extrusion-height': altura,
                'fill-extrusion-base': 0,
              }}
            />
          </Source>
        )}

        {active && (
          <Source id="ruta" type="geojson" data={line(active.ruta)}>
            <Layer
              id="ruta-linea"
              type="line"
              layout={{ 'line-cap': 'butt', 'line-join': 'round' }}
              paint={{
                'line-color': c.lima,
                'line-width': 3.5,
                'line-dasharray': [2, 1.5],
              }}
            />
          </Source>
        )}

        <Marker longitude={longitud} latitude={latitud} anchor="bottom">
          <div aria-hidden="true" className={styles.here}>
            {nombre}
          </div>
        </Marker>

        {pois.map((poi, i) => (
          <PoiMarker
            key={poi.id}
            poi={poi}
            number={i + 1}
            active={poi.id === activeId}
            highlighted={poi.id === hoverId}
            onSelect={onSelect}
            onHover={onHover}
          />
        ))}
      </MapGL>

      {active && (
        <button type="button" className={styles.reset} onClick={onReset}>
          <span aria-hidden="true">← </span>Volver al edificio
        </button>
      )}
    </div>
  );
}
