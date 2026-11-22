# Scroll y carga dinámicos

Borrador pendiente de aprobación. Define qué se mejora en la carga y en el scroll de iPuente, con qué reglas y cuándo se da por terminado.

## Objetivo

Que la web se sienta como recorrer un edificio por plantas: una carga con carácter, un scroll fluido y movimiento que explica el contenido en lugar de decorarlo. Sin secuestrar el scroll y sin hacer la web más lenta.

## Referencia analizada

`https://grayainstitute.com.au/` (mirada en su HTML, CSS y fragmentos JS descargados; no se copia nada):

- Scroll **nativo**, sin Lenis ni GSAP detectados en sus fragmentos.
- Un edificio dibujado con unos 565 `<path>` SVG (`pathLength="1"`, retardo propio `--d`) y polígonos que se iluminan escalonados.
- CSS con `animation-timeline` (12 usos), `view-timeline`, `position: sticky`, `stroke-dashoffset` y `clip-path`.
- Una intro con bloqueo de scroll (`intro-scroll-lock`), texto partido por palabras (`data-word`) y 9 bloques de `prefers-reduced-motion`.
- `modulepreload` de los fragmentos y `preload` de las imágenes críticas.
- Deducción, sin confirmar: que el dibujo lo mueva el CSS (`animation-timeline`) y no el JS.

## Qué hacemos en iPuente

1. **Carga:** la puerta «iP» de `client/src/pages/Landing/LandingLoader/` pasa a dibujar la planta por líneas mientras llegan los recursos; `preload` de fuentes y datos críticos en `client/index.html`.
2. **Edificio que se arma al bajar:** hero fijado (`sticky`) donde el scroll abre las plantas del 3D (`client/src/components/building/Building3D/`) en vez del clic.
3. **Texto por líneas:** revelado sobrio en los títulos grandes.
4. **Planta 2D que se dibuja:** contornos de las salas con trazo y luego relleno por estado (`client/src/components/floor-plan/FloorPlan/`).

Ideas propias, a decidir paso a paso: ascensor lateral PB/1/2/3 que sigue la sección; ventanas que se encienden en las plantas con salas libres; losas de la cabecera de edificio que se separan y pasan el relevo al 3D; `content-visibility: auto` en secciones fuera de pantalla.

## Reglas

- **Mobile first:** base móvil y `@media (min-width: …)` para escritorio; nada de `max-width`.
- **Sin librerías nuevas** de scroll ni animación: CSS `animation-timeline` donde exista soporte y `IntersectionObserver` como respaldo (`@supports`).
- **Sin secuestrar el scroll:** ningún bloqueo de scroll más allá de la carga inicial, que dura como máximo 1 s y se puede saltar.
- **Un solo momento orquestado por pantalla:** nada de entradas con fundido y deslizamiento en todas las secciones.
- **Accesibilidad:** con `prefers-reduced-motion` todo queda quieto y el contenido es el mismo; el foco y el teclado no cambian; el movimiento es siempre decorativo o redundante.
- **3D:** seguir `.claude/skills/3d` (`dpr` máximo 2, `frameloop="demand"` cuando no haya animación continua, pausar fuera de pantalla).

## Notas de implementación

- **Revelado de títulos (`Reveal`):** usa `IntersectionObserver` y no `animation-timeline`, porque un título debe entrar una sola vez y no avanzar y retroceder con el scroll. `animation-timeline` queda para lo que sí va ligado al scroll (pasos 4 y 5), con `useScrollProgress` como respaldo.
- **Una sola pantalla, un solo efecto:** `Reveal` se aplica solo al `h1` de búsqueda, planta y sala, que no tienen otro movimiento orquestado. La landing ya tiene el cargador y la cabecera del edificio tiene las losas.

## Presupuesto de rendimiento

- El paquete principal de JS no crece más de 10 kB respecto a los 442 kB actuales; lo nuevo va en diferido.
- Sin saltos de diseño (CLS) por la carga ni por los reveals.
- El LCP de la landing no empeora respecto a hoy (medirlo antes y después).

## Flujo de trabajo

Un paso cada vez y con confirmación entre pasos. Agentes del repo: `analista` → `front` → `qa` → `revisor` (la PR la abre el revisor y la fusiona una persona).

## Hecho cuando

Estado a 22-11-2026, con compilaciones de producción (`vite build` y `vite preview`, Firebase ficticio, sin API) medidas en un iframe de 390 px frente a la compilación anterior al scroll (`f5f7b6d`).

- [x] La carga de la landing dibuja la planta, se puede saltar, dura 1 s (600 ms de dibujo + 400 ms de apertura, medido en desarrollo) y solo se ve la primera vez de la sesión.
- [x] LCP: landing 2444 ms → 1420 ms (mediana); búsqueda 192 → 148 ms; las demás pantallas, dentro del ruido (±30 ms). CLS: 0 en edificio, planta, sala y búsqueda (antes 0,14–0,39); en la landing 0,0003 y en edificio a 1100 px de ancho 0,0037. El salto lo causaba el pie visible mientras cargaba el fragmento de la pantalla (`Suspense` del `Layout`).
- [x] En la landing, bajar abre las plantas del 3D sin clic (escritorio fijado y móvil por cruce) y con el mismo resultado que elegir la planta a mano.
- [x] Los títulos principales de búsqueda, planta y sala se revelan por líneas con un único efecto por pantalla.
- [x] La planta se dibuja con trazo y rellena por estado (en el plano 3D).
- [x] Todo funciona en 390 px y en escritorio, sin scroll horizontal (comprobado en landing, búsqueda, edificio, planta y sala).
- [x] Con `prefers-reduced-motion` no hay movimiento y el contenido es el mismo. Probado emulando la preferencia (se sobrescribe `matchMedia` y se reescriben las reglas CSS `@media (prefers-reduced-motion: …)`; no se cambió el ajuste del sistema): la landing no muestra cargador (sin `inert` ni scroll bloqueado), no hay carrera, el edificio no se fija y el 3D no se abre al bajar; el `h1` de búsqueda sale como texto plano; las etiquetas de la planta salen ~0,9 s antes (sin dibujo).
- [x] Sin cambios de comportamiento con el teclado ni con lector de pantalla, probado con el árbol de accesibilidad de Chrome y el DOM (**no con NVDA, JAWS ni VoiceOver**): el cargador anuncia «Cargando iPuente» y «Listo» con `role="status"` y deja la página `inert` solo mientras dura; bajar por el hero no cambia ninguna región viva; el `h1` de `Reveal` lleva el texto completo en un `<span>` para lectores y las palabras partidas con `aria-hidden`; los botones del `NumberStepper` tienen nombre; la leyenda del hero no es una región viva y en móvil queda oculta (no tabulable). **Corregido:** la leyenda estaba antes del buscador en el DOM y el foco saltaba a ella y volvía; ahora va después y el orden de tabulación sigue al visual.
- [x] Sin dependencias nuevas; el paquete principal pasa de 460,02 kB a 462,27 kB (+2,25 kB, gzip +0,67 kB; el límite era 10 kB).
- [x] `npm run lint` y `npm run build` sin errores, `npm test -w client` con 10 pruebas en verde y la documentación de `AGENTS.md` al día.
