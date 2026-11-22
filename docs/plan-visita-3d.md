# Plan: recorrer el edificio en 3D (inspirado en arshkhachatrian.com)

Borrador pendiente de aprobación. No se ha tocado código. Estimación total: **87–127 horas**, repartidas en 10 fases que se pueden fusionar por separado.

## 1. Qué hemos mirado de la referencia

`https://arshkhachatrian.com/` es el portfolio de un ingeniero frontend y fotógrafo. Se ha leído su HTML, sus metadatos y los fragmentos de JavaScript descargables; **no se ha podido ver el render en un navegador**, así que lo visual se deduce.

Lo que es evidente:

- **Next.js** (Turbopack) con una escena **three.js** (en los fragmentos aparecen `WebGLRenderer`, `PerspectiveCamera`, `Raycaster` y `AudioContext`). La web se presenta como «recorrer una casa» en 3D.
- **Carga con porcentaje** («preparando la casa») y una **puerta de entrada** (clic o scroll para entrar).
- **Menú de zonas numeradas** (01 a 07) con un patrón de plano de planta de fondo, que lleva a cada sala: la habitación, trabajos, fotografía, sobre mí, música, un proyecto y contacto.
- **Teclado**: flechas para recorrer, teclas 1 a 7 para saltar de zona y Esc para cerrar.
- **Interacciones**: «mover para mirar alrededor», objetos que se arrastran, sonido opcional y un estado de pausa.
- El texto completo está en el HTML (no es una cáscara vacía) y hay un `skip`.

Lo que **no** sabemos: el aspecto exacto, los modelos 3D (se cargan en ejecución), el sonido y cómo se comporta en móvil.

## 2. Qué adaptamos (y qué no copiamos)

La idea que nos interesa es **«el contenido es un lugar que se recorre»**, no su estética. No copiamos la casa, la puerta roja, los textos ni la música.

La metáfora de iPuente ya existe: **un edificio con plantas y salas** y un logo de **puente**. Proponemos: _«Recorre el edificio»_. Entras por el vestíbulo, subes por las plantas y cada zona del recorrido es una parte de la web.

| Zona             | Contenido que ya tenemos                      |
| ---------------- | --------------------------------------------- |
| 01 El edificio   | hero con el 3D del edificio y el buscador     |
| 02 Plantas       | `FloorSection`: plantas, salas libres y plano |
| 03 Salas         | salas destacadas                              |
| 04 Cómo funciona | `HowItWorks`                                  |
| 05 Alrededor     | mapa 3D y lugares cercanos                    |
| 06 Empresas      | `CompaniesCta`                                |
| 07 Reservar      | buscador y llamada a la acción                |

## 3. Lo que ya tenemos y reutilizamos

- **3D:** `Building3D` (con despiece), `FloorPlan` con interiores (`RoomInterior`), `LazyCanvas`, Three.js y R3F ya instalados.
- **Movimiento:** `LandingLoader` (planta dibujada), `useScrollProgress` (modos `view`, `pin` y `page`), `Reveal`, el hero que abre plantas y la planta que se dibuja.
- **Identidad:** el **cable del puente** (rama `CLI014-cable-del-puente`) se convierte en el **hilo del recorrido**: marca en qué zona estás.
- **Skills:** `modelado-3d-web` y `objetos-3d-threejs` (`.claude/skills/3d`) para los presupuestos de modelos.

## 4. Reglas que no se negocian

1. **Primero la conversión.** Quien solo quiere reservar nunca debe pasar por la visita: «Saltar la visita» siempre visible y los accesos a Buscar y Reservar en la cabecera.
2. **Alternativa sin 3D completa.** Sin WebGL, con movimiento reducido o con poca batería, las mismas zonas se muestran apiladas como hoy (contenido idéntico en el DOM).
3. **Accesibilidad:** el contenido real vive en el DOM y no solo en el canvas; teclado a la par (flechas, teclas 1 a 7, Esc); foco que sigue a la zona; sin secuestrar el scroll del navegador.
4. **Mobile first** y presupuestos de la skill 3D: escena < 5 MB, < 150 k triángulos en móvil, `dpr` máximo 2, `frameloop` bajo demanda.
5. **Sin librerías pesadas nuevas** sin avisar antes.
6. **El LCP no empeora:** el texto del hero se pinta antes que la escena.

## 5. Fases

Cada fase termina con un «Hecho cuando» medible y se entrega en una PR aparte.

### F0 · Diseño del recorrido (6–8 h)

Storyboard de las 7 zonas; decisión del modelo de cámara (carril guiado por scroll frente a mirada libre); plano del menú de zonas; qué hace cada pieza en móvil; fichas de presupuesto por zona.
**Hecho cuando:** hay un storyboard aprobado y una tabla de presupuesto (triángulos, MB, FPS objetivo) por zona.

### F1 · Escena única y cámara sobre carril (10–14 h)

Un solo `Canvas` fijo detrás del contenido de la landing, montado en diferido; un grafo de escena por zonas; cámara sobre una curva, movida por `useScrollProgress`; calidad por niveles (dpr, sombras, antialias) según el dispositivo.
**Hecho cuando:** bajar por la landing mueve la cámara de zona a zona a 60 FPS en un portátil medio y a 30 como mínimo en un móvil de gama baja.

### F2 · Modelado del vestíbulo y de cada zona (14–20 h)

Piezas procedurales (0 KB de descarga) con la paleta Bosque, reutilizando `RoomInterior`; un par de modelos `.glb` solo si hacen falta, dentro del presupuesto.
**Hecho cuando:** cada zona tiene su escena reconocible y el conjunto respeta el presupuesto.

### F3 · Entrada y navegación (8–10 h)

Carga con porcentaje real (de lo que se descarga) y «Entrar»; menú de zonas numeradas con el patrón de plano de planta; teclas 1 a 7, flechas y Esc; cada zona con su ancla en la URL (`#plantas`); «Saltar la visita».
**Hecho cuando:** se puede recorrer y saltar entre zonas solo con teclado, y compartir una zona por URL.

### F4 · Interacciones (10–14 h)

Mirar alrededor con el puntero (en móvil, un toque lo sustituye, sin giroscopio); salas que se iluminan al pasar; un objeto arrastrable con sentido de producto (por ejemplo, las sillas de una sala de «Cómo funciona»); al pulsar una sala se abre su ficha.
**Hecho cuando:** cada interacción tiene su equivalente con teclado y ninguna es necesaria para reservar.

### F5 · Contenido y textos (6–8 h)

Redactar los textos de cada zona (sin copiar los de la referencia), el microcopy de la entrada y del menú, y pasar el contenido existente.
**Hecho cuando:** el contenido de las 7 zonas está revisado.

### F6 · Sonido de oficina (6–8 h)

Decidido: el sonido es un **ambiente de oficina**. Capas con Web Audio: zumbido suave de aire acondicionado, murmullo lejano, teclados lejanos, y detalles puntuales (impresora, cafetera, teléfono lejano). Un «ding» de ascensor y un paso de puerta al cambiar de zona, que además refuerzan la metáfora del edificio. El volumen y el color del ambiente cambian según la zona (más ruido en «Salas», más calma en «Alrededor»).

- **Origen de los sonidos:** sonidos propios sintetizados con Web Audio donde se pueda (ruido filtrado para el aire acondicionado y el murmullo: 0 KB) y, para lo que no (teclas, impresora, cafetera), muestras cortas con licencia libre (CC0 o similar) con la licencia anotada en el repo. **No se usará audio de la serie «The Office» ni de ningún producto con derechos**: si te referías al sonido de esa serie, no podemos usarlo y lo cambiamos por ambiente de oficina propio.
- **Peso:** menos de 300 KB en total y solo se descarga tras pulsar «Entrar».
- **Cómo se activa:** los navegadores no dejan reproducir sonido sin una acción de la persona. La pantalla de entrada ofrece **«Entrar con sonido»** y **«Entrar sin sonido»**; un interruptor siempre visible lo cambia después y se recuerda.
- **Respeto:** volumen bajo por defecto, se silencia al pasar la pestaña a segundo plano y con `prefers-reduced-motion` no suena nada por defecto.
- **Accesibilidad:** el sonido nunca transmite información que no esté también en pantalla.
  **Hecho cuando:** el ambiente cambia entre zonas sin cortes ni chasquidos, el interruptor funciona con teclado y el peso está dentro del presupuesto.

### F7 · Accesibilidad y alternativa estática (8–10 h)

Contenido paralelo en el DOM, puntos de referencia por zona, gestión del foco al cambiar de zona, ruta sin movimiento con las zonas apiladas, `prefers-reduced-motion` y `prefers-reduced-data`.
**Hecho cuando:** la ruta sin 3D da exactamente el mismo contenido y se ha probado con teclado y lector de pantalla.

### F8 · Rendimiento y móvil (8–12 h)

Medir y recortar: instancias, niveles de detalle, pausa fuera de pantalla, escena simplificada en móvil, división del paquete.
**Hecho cuando:** LCP igual o mejor que hoy, CLS 0, INP razonable y el peso total dentro del presupuesto.

### F9 · Integración con el resto de la web (6–8 h)

Que el recorrido y el resto sean un mismo producto: el cable del puente como hilo de las zonas; transición de la planta elegida en el 3D a su página (`/buildings/:id/floors/:id`); las mismas fichas de profundidad en las demás pantallas.
**Hecho cuando:** entrar en una planta desde la visita lleva a su plano sin cortes.

### F10 · QA y cierre (8 h)

Pruebas de las funciones puras, emulación de movimiento reducido, lector de pantalla, varios dispositivos y navegadores, `AGENTS.md` y documentación al día.

## 6. Riesgos

- **Peso y rendimiento en móvil:** es el riesgo mayor; por eso F1 y F8 llevan cifras.
- **Conversión:** una web «de experiencia» puede estorbar a quien viene a reservar. Se mitiga con «Saltar la visita» y midiendo.
- **Accesibilidad:** un canvas no se lee; por eso el DOM paralelo es obligatorio.
- **Alcance:** 85–125 h es un proyecto en sí. Conviene cortar en fases y poder parar tras F3 con algo usable.
- **Lo visual de la referencia no verificado:** tendremos que ir validando el resultado con vosotros, no contra la referencia.

## 7. Decisiones

Tomadas:

1. **Alcance:** la visita 3D es **solo la landing**. El resto de pantallas (edificio, planta, sala, reservas, cuenta, paneles) no tiene visita, pero sí el cable del puente y la profundidad para que todo sea un mismo producto.
2. **Sonido:** sí, con **ambiente de oficina** (ver F6).

Abiertas: 3. ¿Modelos 100 % procedurales o puedes aportar/encargar modelos `.glb`? 4. ¿Qué hacemos con la rama del cable del puente: **la dejamos como hilo del recorrido** (recomendado) o la cerramos aparte? 5. ¿Cortamos tras F3 para evaluar antes de seguir? 6. Confirmar que «el sonido de tipo office» es ambiente de oficina y no el audio de la serie «The Office» (que no podemos usar).
