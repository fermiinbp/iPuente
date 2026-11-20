# Spec · Mapa «Alrededor» (v2 · realista)

## Referencia
belgradearbor.rs/en → sección Location:
- Título + párrafo corto que sitúa el edificio.
- Mapa con el edificio como punto central.
- Lista de POI: nombre, tiempo a pie y en coche (o solo uno si solo hay un modo) y 2-3 frases de descripción.
- Al elegir un POI, el mapa se mueve hasta él.

## Mapa realista
- Librería: MapLibre GL JS (`maplibre-gl`) + `react-map-gl/maplibre`. Pedir confirmación antes de instalarlas.
- Teselas: OpenFreeMap (gratis, sin API key). Estilo base `https://tiles.openfreemap.org/styles/positron`, recoloreado.
- Vista: pitch 55°, bearing -20°, zoom 16 centrado en el edificio.
- Edificios del entorno: capa `fill-extrusion` con `render_height`, color #2f4329 y opacidad .85.
- Edificio iPuente: extrusión propia en bronce #b8894a, más alta y con un halo suave.
- Al hacer clic en un POI: `flyTo` (1.2 s, easing suave) y la ruta del edificio al POI dibujada con una línea discontinua lima.
- Dejar la atribución de OSM visible, que es obligatoria.

## Estilo (paleta Bosque)
- Suelo #18240f · agua #2f4329 · parques #24331f · calles #506a49 (las principales un poco más claras)
- Etiquetas: crema suave #c4c9b4, en Hanken Grotesk; quitar los POI del mapa base.
- Pines: bronce; el activo en lima #cfe36a, con número y nombre (que no dependa solo del color).
- Titulares en Newsreader, en cursiva el POI activo.

## Interacción
- Lista y pines sincronizados al pasar el ratón, al enfocar y al hacer clic.
- Teclado: Tab por la lista; Enter activa el POI. Botón «Volver al edificio».
- Rueda del ratón desactivada hasta que se haga clic en el mapa, para que no secuestre el scroll.
- Móvil: el mapa arriba (60vh) y la lista debajo; pitch reducido a 40°.
- Con `prefers-reduced-motion`, el cambio de vista es instantáneo, sin vuelo.

## Datos
- `client/src/data/poi.json`: { id, nombre, categoria, minPie, minCoche?, descripcion, lat, lng }
- Coordenadas del edificio en la config. Hasta que el equipo las confirme, se usan provisionales (Sevilla).