# Plan: fondo con profundidad y estampas sobre el edificio

Estado: **borrador revisado para aprobar** (segunda versión, tras tu aclaración). Es solo un plan: no toca `client/` ni instala nada. Se avanza fase a fase y entre una y otra se espera un OK.

## 1. Qué se quiere

1. **El edificio gira solo, con el efecto del artefacto (variante A), y solo en la cabecera:** cinco plantas que flotan y giran despacio; el scroll las gira un poco más y las abre un poco (las plantas se separan). El 3D vive únicamente en el hero de la landing, que pasa a ser el escenario fijado donde aparecen las estampas. Se conserva el arrastre para girar de `Building3D`; **las flechas del teclado se quitan** (el teclado usa las estampas y la lista de salas).
2. **Ponerle detrás un fondo con profundidad**: capas, luz y grano, sin cambiar la paleta Bosque.
3. **Añadir estampas** que van apareciendo según se hace scroll sobre el edificio, cada una con el estado de una sala. Al pulsar una estampa se abre la ficha y desde ella se reserva.

Cambia respecto a la primera versión: no se crea una escena 3D nueva. Se amplía `Building3D` con **props aditivas** (por defecto se comporta como hoy) y el scroll alimenta solo dos cosas: la aparición de las estampas y ese empuje extra del giro.

## 2. Cómo se aplican las skills de `.claude/skills`

### `frontend-design`

| Principio de la skill | Qué decide este plan |
| --- | --- |
| Abrir con lo más característico del tema | El edificio con las salas estampadas es lo primero que se ve. |
| Gastar la audacia en un solo sitio | La memorable es la aparición de las estampas. El fondo es sereno y no compite con ellas. |
| Movimiento no pedido, con mesura | Un solo momento orquestado (las estampas); el parallax del fondo es mínimo. Nada de entradas «fade y slide» por sección ni hovers en cada tarjeta. |
| Evitar los tics genéricos | Sin etiquetas en mayúsculas sobre los títulos, sin numeración si no es una secuencia, sin resaltar una sola palabra del titular, sin flechas «→» en los botones. |
| Estructura que informa | Los bordes y trazos de la estampa codifican el estado (continuo: libre; grueso: ocupada; discontinuo con trama: no se alquila). |
| Texto escrito pensando en la persona | Los botones dicen lo que pasa: «Ver sala» y «Reservar». Una sala ocupada explica por qué no se reserva. |
| Calidad mínima | Móvil, foco visible, movimiento reducido y contraste AA. |

Antes de construir, la fase 1 pasa el plan visual (tokens, capas y un boceto ASCII) por el filtro de la skill: si algo se parece a lo que haría cualquier landing, se cambia.

### `react-best-practices` (reglas que se aplican y dónde)

| Regla | Dónde |
| --- | --- |
| Importación dinámica de lo pesado | `Building3D` ya va con `React.lazy`; las estampas y la ficha también (fase 6). |
| Suspense estratégico | El fondo y las estampas pintan ya; el 3D llega con su alternativa. |
| Sin importaciones por barril | Imports directos desde cada archivo, como en el resto del repo. |
| Suscribirse a estado derivado | `useSyncExternalStore` para la planta activa: solo re-renderiza al cruzar de planta, no en cada píxel. |
| Diferir lecturas de estado | El progreso vive en un `ref`; las estampas se actualizan escribiendo variables CSS, sin renderizar. |
| Elevar lo estático | Datos de estampas y capas del fondo fuera de los componentes. |
| Dependencias de efecto estrechas | `useScrollProgress` solo depende del elemento. |
| Sin cascadas de peticiones | `Promise.all` para las plantas (fase 9). |
| `content-visibility` | En la lista alternativa de salas, que es larga. |
| Render condicional explícito | `{tier === 'full' ? … : …}` en lugar de `&&` con valores que pueden ser 0. |
| Transiciones para lo no urgente | Abrir la ficha con `startTransition`. |
| Manejadores en refs | El de scroll no se recrea. |

## 3. Lo que ya hay (se reutiliza tal cual)

| Pieza | Ruta | Papel |
| --- | --- | --- |
| `Building3D` | `client/src/components/building/Building3D/Building3D.jsx` | El edificio y su giro manual (OrbitControls con arrastre). Se le quitan las flechas del teclado y se amplía con props aditivas para el giro automático (fase 4); sin ellas, igual que hoy. |
| `BuildingHero` | `client/src/components/building/BuildingHero/BuildingHero.jsx` | Ya elige 3D (WebGL) o bandas CSS sin WebGL, con `React.lazy`. Sirve de nivel sin 3D. |
| `LazyCanvas`, `ErrorBoundary` | `client/src/components/three/` | Carga diferida, render bajo demanda y alternativa. |
| `useReducedMotion`, `useNearViewport`, `useMediaQuery` | `client/src/hooks/` | Movimiento reducido, montaje al acercarse y nivel por dispositivo. |
| `FLOORS_HERO` | `client/src/pages/Landing/heroBuildingData.js` | Plantas y estado de ejemplo. |
| `SidePanel`, `BottomSheet`, `StatusBadge`, `Chip` | `client/src/components/ui/` | Ficha y etiquetas de estado. |
| Variables `--bosque*`, `--libre`, `--sombra-1/2/3` | `client/styles/style.css` | Paleta y elevaciones. |
| `getFloor(id)` y `/rooms/:roomId` | `services/floorsService.js`, `App.jsx` | Datos reales y destino de «Reservar». |

Dos avisos:

- `docs/diseno/variantes-estilo.md` **no existe**; solo `fundamentos.md`. El brief de variantes se guarda ahí en la fase 0.
- Los hooks de scroll de la rama del cable (`useScrollProgress`, `useZones`, `useVisitTier`) **no están en `main`**; esta implementación crea los suyos.

## 4. Decisiones de librería

| Opción | Decisión | Motivo |
| --- | --- | --- |
| Scroll nativo + hook propio | **Elegida** | Sin dependencias nuevas; el teclado funciona; la landing sigue siendo una página normal. |
| `ScrollControls` de drei | Descartada | Crea su propio contenedor de scroll y rompe la página, el teclado y el resto de secciones. |
| GSAP + ScrollTrigger | Descartada de momento | Dependencia nueva (~30 KB) para algo que se resuelve con ~40 líneas. Se reconsidera solo con tu permiso. |
| drei `Html` para las estampas | Descartada | Orden de foco impredecible y solapes difíciles. |
| Estampas como DOM normal fuera del canvas | **Elegida** | `<button>` reales, accesibles y reutilizables sin 3D. |

**No se instala nada.**

## 5. Flujo

```
scroll de la ventana
   │
   ▼
useScrollProgress(trackRef) ── única fuente ──► progreso p (ref, sin useState)
                                                  │
        ┌─────────────────────────────┬───────────┴────────────────────┐
        ▼                             ▼                                ▼
 BuildingBackdrop (CSS)       StampLayer (CSS vars)          BuildingStamps (React)
 capas con parallax           stampProgress(p, i) → --k       planta activa = floorAt(p)
 (--progreso)                 posición = altura de su planta  (solo cambia al cruzar planta)
                                          │ clic o Enter
                                          ▼
                                   RoomSheet (ficha) ── «Reservar» ──► /rooms/:roomId
```

El giro automático es del propio edificio: un reloj interno lo hace avanzar a velocidad constante (como `spin += dt * 0.16` del artefacto). El scroll solo le suma un **empuje** (`spinKick`, como `scrollTop * 0.0008`). Las estampas se anclan a la **altura** de su planta, que no cambia al girar en horizontal, así que siguen en su sitio.

Un solo `p`: capas del fondo, empuje del giro, estampas y planta activa salen de él mediante funciones puras en `client/src/utils/scrollTimeline.js` (`stampProgress`, `floorAt`, `backdropShift`, `spinKick`). El reloj del giro automático no es estado de React ni se duplica con `p`: vive dentro del `useFrame` de la escena.

## 6. Fondo con profundidad (de atrás hacia delante)

| Capa | Qué es | Movimiento |
| --- | --- | --- |
| 0 | Degradado vertical de `--bosque-profundo` a `--bosque` | Ninguno |
| 1 | Dos formas orgánicas grandes y desenfocadas en `--bosque-elevado` y bronce suave | Parallax mínimo con `--progreso` |
| 2 | Halo de luz crema suave tras el edificio, para separar la silueta | Ninguno |
| 3 | Grano fino (`soft-light`, baja opacidad) | Ninguno |
| 4 | Canvas 3D transparente (el edificio) | Su giro de siempre |
| 5 | Estampas (DOM) | Aparecen con el scroll |
| 6 | Suelo: degradado inferior y la sombra de contacto que ya dibuja el 3D | Ninguno |

Límites: contraste AA del texto sobre las capas (el bronce solo como forma, no como texto pequeño), y con movimiento reducido las capas quedan quietas. A confirmar en el spike de la fase 1: que el canvas actual de `Building3D` tenga fondo transparente.

## 7. Árbol de componentes

```
client/src/pages/Landing/BuildingStamps/
  BuildingStamps.jsx (+ .module.css)      Sección: pista alta con escenario fijado (sticky)
  ├─ BuildingBackdrop/BuildingBackdrop.jsx   Capas del fondo (solo CSS)
  ├─ Building3D  (el actual, sin cambios en el giro)   dentro de BuildingHero o directo, con su alternativa
  ├─ StampLayer/StampLayer.jsx              Lista <ol> de estampas colocadas por altura de planta
  │   └─ client/src/components/room/RoomStamp/RoomStamp.jsx   <button> con código, precio, aforo y estado escrito
  ├─ RoomSheet/RoomSheet.jsx                Ficha: SidePanel en escritorio y BottomSheet en móvil
  └─ lista alternativa de salas             Para teclado y lectores, siempre en el DOM

client/src/hooks/useScrollProgress.js       Progreso 0..1 de la pista; escribe --progreso
client/src/utils/scrollTimeline.js          Funciones puras
client/src/utils/stampData.js               Adaptador API → estampas
client/src/data/landing-edificio.json       Mock con la forma de la API
client/tests/scrollTimeline.test.js         Pruebas de las funciones puras
```

Un componente por carpeta con su `.jsx` y su `.module.css`; CSS mobile first, sin `max-width`.

## 8. Datos

- **Mock:** `client/src/data/landing-edificio.json` con la forma de `GET /api/floors/:id` (`salas` con `id`, `codigo`, `nombre`, `estado` `FREE`/`OCCUPIED`/`UNAVAILABLE`, `precioHora`, `capacidad`, y `x,y,w,h` del `mapData`) más la lista de plantas.
- **Adaptador:** `stampData.js` traduce el estado a `libre`, `ocupada` o `no se alquila`, con su texto, y reparte las salas por planta. Con la API real solo cambia el origen.
- Pendiente con back: qué edificio es el destacado de la landing (hoy no hay endpoint que lo diga).

## 9. Fases

Cada fase termina con `npm run lint`, `npm run build` y una prueba en móvil de 390 px, y espera tu OK. Rama y commits con el código de issue que se asigne; la PR la revisa y fusiona una persona.

### Fase 0: decisiones (0,5 día)
- Guardar el brief en `docs/diseno/variantes-estilo.md`.
- Acordar cuántas estampas entran (propuesta: 6 salas en 3 plantas, 2 por planta) y qué edificio es el destacado.
- Criterio: número de estampas y estilo del fondo acordados.

### Fase 1: fondo con profundidad (1,5 días)
- `BuildingBackdrop` con las capas de la sección 6, usando solo variables del `:root` (nada de colores sueltos).
- Spike: comprobar que el canvas actual es transparente y cómo se ve el edificio sobre las capas; ajustar luz y halo.
- Revisión con `frontend-design` (qué parece genérico y se cambia).
- Criterio: edificio legible, fondo sereno, AA, sin cambio en el giro ni en `Building3D`.

### Fase 2: progreso único y datos (1 día)
- `scrollTimeline.js` + `scrollTimeline.test.js` (bordes, orden, monotonía) y `useScrollProgress.js` (listener pasivo, un `requestAnimationFrame` por fotograma, solo escucha cerca de la pantalla; con movimiento reducido devuelve 1).
- `landing-edificio.json` y `stampData.js`.

### Fase 3: estampas sobre el edificio sin 3D (2 días)
- `RoomStamp`, `StampLayer` y `BuildingStamps` con el edificio de `BuildingHero` en su versión sin 3D, y la aparición ligada a `p` (variable `--k`, sin renderizar).
- Teclado: cada estampa es un `<button>`; las no colocadas son `inert`. Texto de estado, símbolo y trazo, nunca solo color.
- Es también el nivel de **móvil y sin WebGL**, así que ya es utilizable.
- Criterio: recorrido completo con teclado y lector de pantalla.

### Fase 4: giro automático y apertura con el scroll, como el artefacto (2,5 días)
- Props aditivas en `Building3D` (por defecto, comportamiento actual): `autoRotate`, `autoRotateSpeed` (equivalente a ~0,16 rad/s, una vuelta en unos 40 s), `spinKickRef` (empuje del giro con el scroll), `openRef` (apertura de las plantas con el scroll) y `frameloop`.
- Flotar y abrir: las plantas oscilan muy poco en vertical y, con `p`, se separan hasta un máximo contenido (en el artefacto, de 0,3 a 0,5 de separación). Se calcula con `openAt(p)` en `scrollTimeline.js`. Hay que desplazar cada planta en `Scene()`: spike de media hora para medir cómo encaja con la apertura de planta que ya existe.
- Teclado: se elimina el giro con flechas (`onKeyDown` y `KEY_STEP`) y el `tabIndex` del grupo; el canvas queda como imagen con su descripción.
- Implementación: `autoRotate` de `OrbitControls` (ya presente) o, si no encaja con el límite de cámara, un giro del grupo en `useFrame`. Spike de media hora para elegir.
- `LazyCanvas` trabaja con `frameloop="demand"`: mientras el giro está activo hay que invalidar cada fotograma. Reglas para no gastar batería:
  - se pausa al salir de pantalla (`IntersectionObserver`) y con la pestaña oculta;
  - se pausa mientras se arrastra y se reanuda a los 3 s sin tocar;
  - con `prefers-reduced-motion` y en el nivel sin 3D no hay giro ni apertura animados.
- Pruebas: `spinKick` y `openAt` en `scrollTimeline.test.js` (bordes y monotonía); manual: el arrastre y el clic en planta siguen como antes.
- Criterio: gira solo, el scroll lo gira y lo abre un poco, el arrastre no se pierde y el consumo es nulo cuando el edificio no se ve.

### Fase 5: estampas con el edificio 3D (1 día)
- Colocar cada estampa a la altura de su planta sobre `Building3D`. Spike de media hora: medir la altura de cada planta desde las constantes de `building3dModel.js` y, si hace falta, una prop **solo de lectura** (por ejemplo `onFloorAnchors`).
- Máximo 2 estampas por planta, repartidas a izquierda y derecha para que no se solapen.

### Fase 6: ficha y reserva (1,5 días)
- `RoomSheet` (`SidePanel` desde 900 px, `BottomSheet` en móvil, con `useModalFocus`), cargado en diferido y abierto con `startTransition`.
- Contenido: nombre, estado escrito, precio, capacidad y equipamiento. «Reservar» lleva a `/rooms/:roomId`; si la sala está ocupada o no se alquila, se explica. Enlace directo con `?sala=`.
- El foco vuelve a la estampa al cerrar.

### Fase 7: rendimiento, movimiento reducido y móvil (1 día)
- Nivel `full` (puntero fino, 960 px o más, WebGL, sin ahorro de datos) o sin 3D (móvil, tableta, `saveData`, sin WebGL). Función pura probada con `node:test`.
- Con `prefers-reduced-motion`: todas las estampas visibles, capas quietas y la pista no se fija.
- Medir CLS 0, chunk de 3D y fotogramas en un móvil real.

### Fase 8: integración y pulido (1 día)
- `BuildingStamps` pasa a ser el hero de `Landing.jsx` y sustituye a `HeroStory` (el 3D solo vive en la cabecera); se mueven a `_to_delete/` las piezas del hero antiguo que queden sin uso.
- Revisión final con las dos skills y actualización de `AGENTS.md`.

### Fase 9: datos reales (1 día, depende de back)
- Cambiar el mock por `getFloor` de cada planta, con `Promise.all`, estados de carga y error.

## 10. Riesgos

| Riesgo | Cómo se evita |
| --- | --- |
| El canvas actual no es transparente | Spike de la fase 1; si no lo es, solo se ajusta el fondo de la escena, no el giro. |
| `position: sticky` roto por un ancestro con `overflow` | `overflow-x: clip` y prueba temprana en la fase 3. |
| Barra de direcciones de iOS | Usar `svh`. |
| Giro automático que gasta batería o pelea con el arrastre | Pausa fuera de pantalla, con la pestaña oculta y mientras se interactúa; sin giro con movimiento reducido ni en móvil sin 3D. |
| Tocar `Building3D` rompe la página de planta o el hero | Solo props aditivas con valores por defecto iguales a hoy; probar ambas pantallas. |
| Estampas que se solapan | 2 por planta, reparto izquierda/derecha y separación mínima. |
| Alguien gira el edificio y la estampa no sigue | Anclaje por altura, no por giro; se prueba arrastrando. |
| Contraste del texto sobre las capas | Comprobar AA con las capas encendidas. |
| Estampas ocultas para lectores | Lista alternativa siempre en el DOM y enlace «Ir al listado de salas». |
| Mock distinto de la API | El mock sigue la forma de `GET /floors/:id` y pasa por el mismo adaptador. |
| Documentación desfasada | Corregir `AGENTS.md` en cada fase. |

## 11. Estimación

| Fase | Días (una persona) |
| --- | --- |
| 0 Decisiones | 0,5 |
| 1 Fondo con profundidad | 1,5 |
| 2 Progreso único y datos | 1 |
| 3 Estampas sin 3D | 2 |
| 4 Giro automático y apertura | 2,5 |
| 5 Estampas con el 3D | 1 |
| 6 Ficha y reserva | 1,5 |
| 7 Rendimiento y móvil | 1 |
| 8 Integración y pulido | 1 |
| 9 Datos reales | 1 |
| **Total** | **13** |

Si el plazo aprieta, las fases 0 a 3 dan ya una landing con fondo y estampas funcional y accesible sin 3D.

## 12. Hecho cuando

- El edificio de la cabecera gira solo; el scroll lo gira un poco más y abre sus plantas un poco; conserva el arrastre (sin flechas del teclado) y tiene un fondo con profundidad detrás.
- Las estampas van apareciendo con el scroll, ancladas a su planta, y dicen su estado con texto, símbolo y trazo.
- Pulsar una estampa abre la ficha y lleva a reservar la sala.
- Con teclado, sin WebGL, en móvil o con movimiento reducido todo funciona sin el 3D.
- Three.js no entra en el chunk inicial y el CLS es 0.

## 13. Estado de la implementación

Rama `CLI014-edificio-estampas`, sin commits todavía.

| Fase | Estado | Notas |
| --- | --- | --- |
| 0 Decisiones | Hecha | `variantes-estilo.md`. |
| 1 Fondo con profundidad | Hecha | `BuildingBackdrop`; el canvas ya era transparente. |
| 2 Progreso único y datos | Hecha | `scrollTimeline.js`, `progressStore.js`, `useScrollProgress.js`; 9 pruebas con `npm test -w client`. Los datos salen de `FLOORS_HERO` y `roomsForFloor`, no de un JSON nuevo, para tener una sola fuente de ejemplo y ids que existen en la ficha de demostración. |
| 3 Estampas sin 3D | Hecha | `RoomStamp`, `StampLayer`; nivel `static` (lista, sin 3D). |
| 4 Giro automático y apertura | Hecha | Props aditivas en `Building3D`; flechas quitadas solo en la landing (`keyboardTurn={false}`), el resto de pantallas igual que antes. |
| 5 Estampas con el 3D | Hecha | Anclas por planta; separación de 96 px por lado y estampas compactas. |
| 6 Ficha y reserva | Hecha | `RoomSheet` con `?sala=`. |
| 7 Rendimiento y móvil | Hecha | `useBuildingTier` (`full`, `calm`, `static`). |
| 8 Integración y pulido | Hecha | `BuildingStamps` sustituye a `HeroStory` (movido a `_to_delete/`). |
| 9 Datos reales | Pendiente | Depende de back (edificio destacado) y de cambiar el origen de `stampData.js` a `getFloor`. |
