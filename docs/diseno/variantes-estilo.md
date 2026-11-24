# Variantes de estilo de la landing

Brief para la landing de iPuente y decisiones de la fase 0 de [`plan-edificio-estampas.md`](./plan-edificio-estampas.md). Los valores de color y tipografía son los de [`fundamentos.md`](./fundamentos.md) y `client/styles/style.css`; aquí no se inventa ninguno.

## 1. Referencia

- https://ordix.org/lv/: gusta su efecto de scroll animado y cómo se van **añadiendo elementos (estampas) al bajar**. Se quiere mejorar la experiencia de usuario con recursos así.
- Lo que se pudo comprobar de esa web en un navegador real: usa anime.js y Snap.svg (no GSAP), el hero queda fijado mientras se baja y un trazo grande se dibuja con el scroll. **No se llegó a ver** cómo entran las estampas más abajo, así que esa parte se diseña desde la descripción del equipo.

## 2. Base obligatoria (paleta Bosque)

| Uso | Token (`:root`) | Valor |
| --- | --- | --- |
| Fondo | `--bosque` | `#24331f` |
| Fondo elevado | `--bosque-elevado` | `#2f4329` |
| Fondo profundo | `--bosque-profundo` | `#18240f` |
| Texto | `--crema` | `#f3ecdc` |
| Texto suave | `--crema-suave` | `#c4c9b4` |
| Líneas (decorativas, nunca texto) | `--linea` | `#506a49` |
| Solo activo, seleccionado y foco | `--lima` | `#cfe36a` |
| Edificio, pines, banda | `--bronce` | `#b8894a` |
| Estado libre | `--libre` | `#c3e3b0` |
| Estado ocupada | `--ocupada` | `#c64e34` |
| Estado no se alquila (con trama) | `--no-alquila` | `#9aa793` |

- Tipos: Newsreader (titulares) y Hanken Grotesk (texto).
- Logo: marca «i»-puente; no se modifica.
- Bronce: solo como forma o número grande. Sobre `--bosque` queda en 4,3:1, por debajo de AA para texto pequeño.

## 3. Qué se busca

- Quitar la monotonía: fondos con capas (degradados, grano, formas orgánicas, parallax suave).
- Profundidad: elevaciones, sombras y más variedad de tonos dentro de la paleta.
- Dinamismo con el edificio en 3D y las estampas que aparecen al hacer scroll.

## 4. Límites

- Contraste AA en todo el texto.
- 3D ligero: carga diferida, alternativa estática y respeto a `prefers-reduced-motion`.
- El estado de una sala nunca depende solo del color: texto, símbolo y trazo (continuo: libre; grueso: ocupada; discontinuo con trama: no se alquila).

## 5. Decisiones de la fase 0

| Tema | Decisión | Estado |
| --- | --- | --- |
| Variante | **A · Niebla y grano**: fondo en capas con grano y formas con parallax suave; 3D solo en la cabecera (el edificio flota y gira despacio; el scroll lo gira y lo abre un poco); una sola banda crema al final. Prototipo: https://claude.ai/artifact/Rma6V8C2xunNkd8FZZMsNV (privado) | Aprobada en el plan |
| Giro | Automático, ~0,16 rad/s, con arrastre; sin flechas del teclado | Aprobada en el plan |
| Estampas | **6 salas en 3 plantas, 2 por planta** (plantas 4, 3 y 2 de `FLOORS_HERO`, que tienen 6 salas cada una) | Propuesta: confirmar |
| Edificio destacado | «Edificio Puerta Sur» (Sevilla) de `client/src/pages/Landing/data.js`, con estado de ejemplo | Provisional; falta que back diga cuál se destaca |
| Plantas del 3D | Las 7 de `FLOORS_HERO` (la planta baja es recepción y no se alquila), no las 5 del prototipo | Propuesta: confirmar |
| Rama | `CLI014-edificio-estampas` (épica de cliente CLI014), sin commits todavía | Propuesta: confirmar el código de issue |
