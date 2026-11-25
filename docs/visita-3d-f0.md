# F0 · Diseño del recorrido «Recorre el edificio»

Entregable de la fase F0 de `docs/plan-visita-3d.md`. Es un documento de diseño: **no hay código**. Pendiente de aprobación antes de pasar a la F1.

Decisiones ya tomadas: la visita es **solo la landing**, con **sonido de oficina**, y el resto de pantallas conserva el cable del puente y la profundidad.

## 1. Idea en una frase

La landing es **el edificio visto en corte**, como una casa de muñecas: la cámara **sube por dentro** parada a parada y cada planta es una parte de la web. Se entra por el vestíbulo, se sube en ascensor y se termina en la azotea con la ciudad y el buscador.

Por qué un corte vertical y no un pasillo:

- **Encaja con el producto:** ya tenemos el edificio por plantas y la vista en despiece.
- **Encaja con el scroll:** una torre es alta y estrecha, así que el scroll vertical del móvil es natural y no hay que inventar giros de cámara.
- **Encaja con el logo:** el puente es el hilo que marca dónde estás (el cable del puente).

## 2. Modelo de cámara (decisión de F0)

| Opción                          | Cómo funciona                                               | Veredicto                                         |
| ------------------------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| **A. Carril guiado por scroll** | La cámara sube por una curva; el scroll del navegador manda | **Elegida**                                       |
| B. Mirada libre                 | La persona orbita y se desplaza por la escena               | Descartada: se pierde en móvil y rompe la lectura |
| C. Vídeo / secuencia            | Animación fija                                              | Descartada: pesa más y no es interactiva          |

La opción A se completa con **mirar alrededor con el puntero** (un giro de pocos grados, solo escritorio) y **sin secuestrar el scroll**: se usa el scroll nativo, y el progreso lo lee `useScrollProgress` (modo `pin`).

## 3. Arquitectura que lo hace seguro

El contenido real **sigue siendo HTML**, el mismo de hoy; la escena 3D es una capa **fija detrás**:

```
┌──────────────── ventana ────────────────┐
│  <canvas> fijo, detrás de todo          │  ← la cámara sube con el scroll
│  ┌───────────────────────────────────┐  │
│  │ <section id="planta"> (HTML real) │  │  ← cada sección mide lo que dura su zona
│  │   título, texto, botones, plano   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

Consecuencias:

- **Alternativa sin 3D gratis:** sin WebGL, con movimiento reducido o con «Saltar la visita», se quita el canvas y queda la landing de hoy, con el mismo contenido.
- **Accesibilidad, SEO y anclas** no cambian: siguen `#salas`, `#empresas`, `#como`, `#pie` (los de la cabecera), `#planta` y `#alrededor`; se añade `#reservar`.
- **Una sola `Canvas`** para toda la página, montada en diferido.

## 4. Las siete zonas

El orden mantiene lo que hay y añade el cierre «Reservar». Cambia respecto a hoy: «Alrededor» pasa a ir después de «Empresas» (ver decisión 1 del apartado 9).

| Nº  | Zona          | Planta          | Contenido que ya existe                      |
| --- | ------------- | --------------- | -------------------------------------------- |
| 01  | El vestíbulo  | Planta baja     | hero y buscador (`Landing`, `HeroStory`)     |
| 02  | Plantas       | Planta 1        | selector de plantas y plano (`FloorSection`) |
| 03  | Cómo funciona | Planta 2        | tres pasos (`HowItWorks`)                    |
| 04  | Salas         | Planta 3        | salas destacadas (`RoomCard`)                |
| 05  | Empresas      | Planta 4        | publicar la oficina (`CompaniesCta`)         |
| 06  | Alrededor     | Azotea          | mapa y lugares cercanos (`NearbySection`)    |
| 07  | Reservar      | Azotea (cierre) | buscador y pie                               |

### Storyboard por zona

Cada ficha: **qué se ve**, **qué hace el HTML**, **interacción**, **sonido** y **móvil**.

**01 · El vestíbulo** (planta baja)

- Se ve: la fachada se abre en corte; recepción con la maqueta del puente colgante (pieza de marca) y las puertas del ascensor.
- HTML: el hero actual (título, texto) y el buscador.
- Interacción: al entrar, las puertas del ascensor se abren; el puntero inclina un poco la cámara.
- Sonido: murmullo suave y teclados lejanos.
- Móvil: la cámara encuadra la recepción de frente; sin inclinación.

**02 · Plantas** (planta 1)

- Se ve: el edificio entero en despiece (lo que ya hace el hero) y, dentro, el plano de la planta elegida con sus salas.
- HTML: el selector de plantas, salas libres y «Ver plano» de `FloorSection`.
- Interacción: pulsar una planta la abre; la sala elegida se ilumina (ya existe).
- Sonido: «ding» corto al cambiar de planta.
- Móvil: el selector pasa a una tira horizontal bajo el 3D (como hoy).

**03 · Cómo funciona** (planta 2)

- Se ve: un pasillo de ascensores con tres estaciones: explorar, elegir y reservar.
- HTML: los tres pasos de `HowItWorks`, numerados porque **sí son una secuencia**.
- Interacción: cada estación se enciende al llegar la cámara.
- Sonido: impresora lejana.
- Móvil: las tres estaciones se encuadran de una en una.

**04 · Salas** (planta 3)

- Se ve: cuatro salas abiertas por la pared frontal, una por tipo (reuniones, eventos, formación, box), con su mobiliario.
- HTML: las tarjetas de `RoomCard` y los filtros por tipo.
- Interacción: el filtro apaga las salas que no coinciden; una sala elegida se acerca.
- Sonido: sillas y conversación lejana; la sala elegida se oye un poco más cerca.
- Móvil: dos salas por vista.

**05 · Empresas** (planta 4)

- Se ve: un despacho con una mesa de luz donde un plano se «escanea» y las salas aparecen.
- HTML: `CompaniesCta` y el botón «Publica tu oficina».
- Interacción: el plano se dibuja por líneas, como en el cargador.
- Sonido: teclado y un clic suave al detectar cada sala.
- Móvil: el plano ocupa el ancho completo.

**06 · Alrededor** (azotea)

- Se ve: la azotea con vistas; el 3D se funde con el mapa real (MapLibre) con el edificio y los lugares.
- HTML: `NearbySection`, con la lista accesible de lugares.
- Interacción: elegir un lugar mueve la cámara del mapa, como hoy.
- Sonido: el ambiente de oficina se apaga y entra viento suave.
- Móvil: el mapa va en diferido, como ahora.

**07 · Reservar** (cierre)

- Se ve: la cámara se detiene mirando la ciudad; el edificio queda de fondo.
- HTML: el buscador grande y el pie con «Contacto».
- Interacción: ninguna más; el foco va al campo de ciudad.
- Sonido: aquí entra la **playlist del final** que aportará el equipo (ver decisión 7). Hasta recibirla, el ambiente se apaga y queda silencio.
- Móvil: igual.
- **Además de ser una zona, «Reservar» está siempre visible**: un botón «Buscar salas» fijo (en la cabecera en escritorio y en una barra inferior en móvil) abre el buscador desde cualquier punto del recorrido sin perder el sitio. Quien solo quiere reservar nunca necesita llegar a la zona 07.

## 5. Navegación

**Menú de zonas** (inspirado en la referencia, con nuestro lenguaje): un plano de planta numerado de 01 a 07 al que se llega desde un botón de la cabecera.

```
┌─ Plano del edificio ───────────────────┐
│ 07 Reservar      ┌────────────────┐    │
│ 06 Alrededor     │  (azotea)      │    │
│ 05 Empresas      ├────────────────┤    │
│ 04 Salas         │  planta 3      │    │
│ 03 Cómo funciona ├────────────────┤    │
│ 02 Plantas       │  planta 1      │    │
│ 01 El vestíbulo  └────────────────┘    │
└─────────────────────────────────────────┘
```

**Teclado:**

| Tecla                         | Acción                  |
| ----------------------------- | ----------------------- |
| Flecha abajo, Re Pág, Espacio | zona siguiente          |
| Flecha arriba, Av Pág         | zona anterior           |
| 1 a 7                         | saltar a esa zona       |
| Esc                           | cerrar el menú de zonas |
| S                             | sonido sí o no          |

Las teclas funcionan solo cuando el foco no está en un campo de texto. El salto usa `scrollIntoView` (instantáneo con movimiento reducido).

**Entrada:** el cargador actual (la planta que se dibuja) acaba en dos botones: **«Entrar con sonido»** y **«Entrar sin sonido»**. Siempre hay un **«Saltar la visita»** visible, que deja la landing sin 3D.

## 6. Niveles de calidad

| Nivel            | Cuándo                                                           | Qué cambia                                                                              |
| ---------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **A · Completo** | escritorio (puntero fino y pantalla ancha)                       | sombras suaves, `dpr` hasta 2, inclinación con el puntero                               |
| **B · Ligero**   | **todos los móviles y tabletas, siempre** (decidido)             | sin sombras, `dpr` 1, menos instancias, solo se renderizan la zona actual y las vecinas |
| **C · Sin 3D**   | sin WebGL, movimiento reducido, `save-data` o «Saltar la visita» | la landing actual, sin canvas                                                           |

## 7. Presupuesto por zona

Referencias de la skill `modelado-3d-web`: escena completa menos de 150 k triángulos en móvil y menos de 500 k en escritorio; menos de 50 draw calls en móvil.

| Pieza                                                 | Triángulos móvil | Triángulos escritorio | Modelos `.glb`                         |
| ----------------------------------------------------- | ---------------- | --------------------- | -------------------------------------- |
| Cáscara del edificio (forjados y fachada, compartida) | 40 k             | 80 k                  | procedural (0 KB)                      |
| 01 Vestíbulo                                          | 20 k             | 40 k                  | puente, recepción, ascensor (≈ 450 KB) |
| 02 Plantas                                            | 15 k             | 30 k                  | ya existe (procedural)                 |
| 03 Cómo funciona                                      | 15 k             | 30 k                  | ascensores, impresora (≈ 300 KB)       |
| 04 Salas                                              | 25 k             | 50 k                  | sillas, mesas, sofá (≈ 600 KB)         |
| 05 Empresas                                           | 15 k             | 30 k                  | mesa de luz, planos (procedural)       |
| 06 Alrededor                                          | 5 k              | 10 k                  | procedural                             |
| 07 Reservar                                           | 10 k             | 20 k                  | procedural                             |
| **Suma**                                              | **145 k**        | **290 k**             | **≤ 2 MB objetivo, ≤ 3,6 MB techo**    |

Para no pasarse en pantalla: en cada momento se dibujan solo la zona actual y las vecinas (unos 70–80 k en móvil). Sonido: menos de 300 KB, solo tras «Entrar».

**FPS objetivo:** 60 en un portátil medio; 30 como mínimo en un móvil de gama baja (nivel B). Si baja de 24 FPS de forma sostenida, pasa a nivel C.

## 8. Qué se reutiliza y qué hay que construir

| Reutiliza                                                        | Construir                                   |
| ---------------------------------------------------------------- | ------------------------------------------- |
| `Building3D`, `FloorPlan`, `RoomInterior`, `LazyCanvas`          | La `Canvas` única y el grafo por zonas      |
| `LandingLoader` (planta dibujada), `useScrollProgress`, `Reveal` | Cámara sobre carril y sus paradas           |
| Hero que abre plantas y planta que se dibuja                     | Menú de zonas, teclado y «Saltar la visita» |
| Cable del puente (hilo del recorrido)                            | Sonido de oficina (F6)                      |
| `NearbySection` y su mapa                                        | Piezas nuevas de mobiliario                 |

## 9. Decisiones

Tomadas (22-11-2026):

1. **Orden de las zonas:** «Alrededor» pasa después de «Empresas» para que la azotea cierre el recorrido. Sí.
2. **Modelo de cámara:** carril guiado por el scroll nativo, con un pequeño giro con el puntero en escritorio. Sí.
3. **Zona 07 «Reservar»:** es una zona del recorrido **y además está siempre visible** (botón «Buscar salas» fijo que abre el buscador desde cualquier punto).
4. **Nivel de calidad en móvil:** **siempre empieza en el nivel B (ligero)**; no se decide por rendimiento medido. El nivel A es solo para escritorio. El paso a nivel C por FPS bajos sigue siendo automático.
5. **Corte tras F3:** el proyecto **se evalúa tras la F3** (entrada y navegación) antes de seguir con las demás fases.

Abiertas:

6. **Sonido de oficina:** confirmar que «el sonido de tipo office» es ambiente de oficina y no el audio de la serie «The Office» (que no se puede usar por derechos).
7. **Playlist del final:** el equipo aportará una playlist para la zona 07 (y se enviará más adelante). Antes de integrarla hay que decidir tres cosas:
   - **Derechos:** música con licencia que permita usarla en la web (propia, CC0, CC-BY con atribución o con licencia comprada). Una lista de Spotify o YouTube no se puede reproducir como archivo propio.
   - **Formato:** archivos propios (con su peso dentro del presupuesto de sonido, que hoy es de 300 KB para el ambiente) o un reproductor incrustado del servicio (más pesado y con sus propias condiciones y cookies).
   - **Comportamiento:** se activa solo con «Entrar con sonido» o con el interruptor, empieza en la zona 07, no se superpone al ambiente y se puede pausar.

## 10. «Hecho cuando» de la F0

- [x] El storyboard de las siete zonas está redactado (pendiente de revisión final al ver la F1).
- [x] El modelo de cámara y el orden de las zonas están decididos.
- [ ] La tabla de presupuesto está aprobada: queda por confirmar que cuadra con los modelos reales.
- [ ] Las decisiones 6 y 7 tienen respuesta.
