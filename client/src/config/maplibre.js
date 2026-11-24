// Worker de MapLibre (efecto lateral): lo importan los componentes con mapa (NearbyMap, SearchMap y LocationPicker).
// MapLibre 6 calcula la URL de su worker en tiempo de ejecución y Vite no la ve al construir: en local funciona
// (se sirve node_modules), pero en producción el archivo no se publica y el mapa falla con «Worker failed to load».
// Con `?url` Vite publica el worker y aquí se le dice a MapLibre dónde está.
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

setWorkerUrl(workerUrl);
