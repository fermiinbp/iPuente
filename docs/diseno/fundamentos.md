# iPuente: fundamentos de diseño (Bosque)

Moodboard, paleta y tipografía de la dirección **C · Bosque**. Es la guía de la issue DIS001.

Fuentes de los valores: el prototipo Bosque (`Paleta-Bosque`, con paleta, tipos y logo) y `referencia-01-landing.html` (formas y colores de la Landing). Son archivos locales del equipo que no están en el repositorio por su tamaño. Ningún valor está inventado. Los ratios de contraste son un cálculo propio con la fórmula de luminancia relativa de WCAG 2.x.

## 1. Moodboard

### 1.1 Referencias

Tres webs que el equipo ha marcado como referencia. De cada una solo se toma lo indicado.

| Referencia                           | Qué tomamos                                                                             | Dónde se ve en Bosque                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| https://structureengineering.com.au/ | Inicio de página con pantalla de carga                                                  | Pantalla «Cargando iPuente, N por ciento» del prototipo.                                                           |
| https://belgradearbor.rs/en          | Idea de mapa: una sección «What's around» con tiempos a pie y en coche hasta cada punto | Sección «Alrededor del edificio» («Qué hay cerca» en el wireframe 02): cuánto se tarda en llegar desde cada punto. |
| https://stillform.homes/             | Tono sereno y recorrido interactivo con «Drag to rotate»                                | Edificio que se gira arrastrando («Arrastra para girar») y voz tranquila de los textos.                            |

Límites de esta tabla:

- Las tres páginas se leyeron como texto, no como HTML ni CSS. **Colores y fuentes de las referencias no se han podido comprobar**, y no se copian.
- No se ha podido confirmar la pantalla de carga de structureengineering.com.au: su contenido no la muestra (probablemente depende de JavaScript). Se toma tal como la indicó el equipo.
- Para stillform.homes no había nota del equipo. Lo anotado es lo que se lee en su texto y hay que validarlo.

### 1.2 Criterios

Salen del propio prototipo, no de las referencias.

1. **Sobrio y de confianza.** Hay pagos reales. Fondo verde bosque, texto crema, sin sombras ni degradados.
2. **El color vivo se reserva.** El lima `#cfe36a` solo marca lo activo, lo seleccionado y el foco de teclado. Nunca decora.
3. **Cursiva significa activo.** El elemento seleccionado de una lista pasa a Newsreader cursiva y lima.
4. **El estado de una sala nunca depende solo del color.** Siempre lleva texto («Libre», «Ocupada», «No se alquila») y «No se alquila» lleva además trama diagonal.
5. **El bronce es el color de lo construido.** Edificio, pines, números de paso y la sala cuadrada del logo.
6. **El plano se lee sobre papel crema.** Salas en discontinua bronce sobre `#f3ecdc`, para que destaquen sobre el bosque.
7. **Accesible de serie.** Objetivos táctiles de 44 px, `:focus-visible` visible y sin transiciones con `prefers-reduced-motion`.

### 1.3 Logo

Marca: un puente colgante dibujado en línea (torres, cables y tirantes) con una sala cuadrada en bronce sobre la cubierta. Nombre: «iPuente» en Newsreader 400 con la «i» en cursiva, en trazados (sin texto vivo). Tamaño mínimo: logotipo completo a 28 px de alto; por debajo, usar el símbolo pequeño.

Archivos (en `docs/images/`):

| Archivo                         | Uso                                                                                                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ipuente-logo-sobre-claro.svg`  | Logotipo horizontal sobre fondo crema o blanco: tinta `#24331f` y sala `#8a5a24`.                                                                                       |
| `ipuente-logo-sobre-oscuro.svg` | Logotipo horizontal sobre bosque: crema `#f3ecdc` y sala `#b8894a`.                                                                                                     |
| `ipuente-simbolo.svg`           | Marca sola.                                                                                                                                                             |
| `ipuente-simbolo-pequeno.svg`   | Corte simplificado para 16 a 24 px.                                                                                                                                     |
| `iconos/`                       | Favicon (`.ico`, `.svg`, 16/32/48 px), `apple-touch-icon.png`, iconos de 192 y 512 px, `site.webmanifest`, `head-snippet.html` y variantes en negro, blanco y un color. |

Los iconos web aún no están copiados a `client/public/`. Cuando se maquete `client/index.html`, se enlazan con `head-snippet.html`.

Límite conocido: el símbolo es de trazo fino. A 16 px las torres y el cable se funden y los tirantes desaparecen, por eso existe el corte pequeño.

## 2. Paleta

### 2.1 Tokens base

| Token                                 | Hex                   | Uso                                                            |
| ------------------------------------- | --------------------- | -------------------------------------------------------------- |
| `--bosque`                            | `#24331f`             | Fondo de página.                                               |
| `--bosque-elevado`                    | `#2f4329`             | Buscador, menú, secciones alternas.                            |
| `--bosque-profundo`                   | `#18240f`             | Sección de empresas y pie.                                     |
| `--foto-hueco`                        | `#3d5535`             | Hueco de foto mientras no hay imagen.                          |
| `--crema`                             | `#f3ecdc`             | Texto principal, botón principal, papel del plano.             |
| `--crema-suave`                       | `#c4c9b4`             | Texto secundario y placeholders.                               |
| `--linea`                             | `#506a49`             | Filetes y bordes decorativos. Nunca texto.                     |
| `--lima`                              | `#cfe36a`             | Solo activo, seleccionado y foco.                              |
| `--bronce`                            | `#b8894a`             | Edificio, pines y números de paso, sobre fondo oscuro.         |
| `--bronce-oscuro`                     | `#8a5a24`             | Bronce sobre fondo crema y sala cuadrada del logo sobre claro. |
| `--libre` / `--libre-texto`           | `#c3e3b0` / `#14230f` | Estado «Libre».                                                |
| `--ocupada` / `--ocupada-texto`       | `#c64e34` / `#ffffff` | Estado «Ocupada».                                              |
| `--no-alquila` / `--no-alquila-texto` | `#9aa793` / `#050a03` | Estado «No se alquila», siempre con trama.                     |

### 2.2 Tokens secundarios

Aparecen en el prototipo y no estaban en la lista base. Se incluyen para que el CSS reproduzca el plano y el edificio sin valores sueltos. Si no se quieren, se borran del `:root` sin afectar al resto.

| Token                | Hex       | Uso en el prototipo                                 |
| -------------------- | --------- | --------------------------------------------------- |
| `--linea-plano`      | `#5d7656` | Filetes del plano y de la maqueta (31 usos).        |
| `--papel`            | `#fdfaf0` | Fondo del logo sobre claro.                         |
| `--trama-no-alquila` | `#76846d` | Color de la trama diagonal de «No se alquila».      |
| `--bronce-claro`     | `#dcb67a` | Planta del edificio activa (Landing).               |
| `--bronce-borde`     | `#8a6330` | Cubierta y borde inferior de cada planta (Landing). |
| `--bronce-ventana`   | `#6f4f26` | Ventanas del edificio (Landing).                    |

### 2.3 Contraste (WCAG 2.x)

Texto normal exige 4,5:1 (AA). Texto grande (desde 24 px, o 18,66 px en negrita) y componentes de interfaz exigen 3:1.

| Par                                                     | Ratio | Exigido | Resultado            |
| ------------------------------------------------------- | ----- | ------- | -------------------- |
| `--crema` sobre `--bosque`                              | 11,38 | 4,5     | AA                   |
| `--crema` sobre `--bosque-elevado`                      | 9,12  | 4,5     | AA                   |
| `--crema` sobre `--bosque-profundo`                     | 13,75 | 4,5     | AA                   |
| `--crema` sobre `--foto-hueco`                          | 7,00  | 4,5     | AA                   |
| `--crema-suave` sobre `--bosque`                        | 7,88  | 4,5     | AA                   |
| `--crema-suave` sobre `--bosque-elevado`                | 6,32  | 4,5     | AA                   |
| `--crema-suave` sobre `--bosque-profundo`               | 9,52  | 4,5     | AA                   |
| `--lima` sobre `--bosque`                               | 9,47  | 4,5     | AA                   |
| `--lima` sobre `--bosque-elevado`                       | 7,59  | 4,5     | AA                   |
| `--lima` sobre `--bosque-profundo`                      | 11,44 | 4,5     | AA                   |
| `#18240f` sobre `--lima` (filtro activo)                | 11,44 | 4,5     | AA                   |
| `--bronce` sobre `--bosque` (números de 56 px)          | 4,28  | 3       | AA solo texto grande |
| `--bronce` sobre `--bosque-elevado`                     | 3,43  | 3       | AA solo texto grande |
| `--bronce` sobre `--bosque-profundo` (números de 22 px) | 5,17  | 4,5     | AA                   |
| `--bosque` sobre `--crema` (botón principal)            | 11,38 | 4,5     | AA                   |
| `--bosque` sobre `--papel` (logo sobre claro)           | 12,82 | 4,5     | AA                   |
| `--bronce-oscuro` sobre `--crema`                       | 5,00  | 4,5     | AA                   |
| `--bronce-oscuro` sobre `--papel`                       | 5,63  | 4,5     | AA                   |
| `#18240f` sobre `--bronce` (chip «salas detectadas»)    | 5,17  | 4,5     | AA                   |
| `#ffffff` sobre `--bronce-oscuro` (etiqueta «Sala n»)   | 5,88  | 4,5     | AA                   |
| `--libre-texto` sobre `--libre`                         | 11,69 | 4,5     | AA                   |
| `--ocupada-texto` sobre `--ocupada`                     | 4,63  | 4,5     | AA                   |
| `--no-alquila-texto` sobre `--no-alquila`               | 7,92  | 4,5     | AA                   |
| `--no-alquila-texto` sobre `--trama-no-alquila`         | 5,03  | 4,5     | AA                   |
| `--lima` sobre `--bosque` (anillo de foco)              | 9,47  | 3       | AA                   |
| `--lima` sobre `--bosque-profundo` (anillo de foco)     | 11,44 | 3       | AA                   |

Dos puntos que hay que vigilar, porque no cumplen y conviene decidirlos antes de maquetar:

- **`--bronce` sobre `--bosque-elevado` (3,43:1)** solo vale para texto grande. No usarlo para texto normal sobre secciones elevadas.
- **Los filetes no llegan a 3:1:** `--linea` sobre `--bosque` da 2,23, sobre `--bosque-elevado` 1,79; `--linea-plano` da 2,67 y 2,14. Como separadores decorativos están exentos. Los bordes de controles (chips de filtro inactivos, campos del buscador, botón «Menú») identifican un componente y deberían llegar a 3:1. Una opción es usar `--crema-suave` (7,88:1) como borde de control, pero eso cambia el prototipo y no lo he aplicado.

## 3. Tipografía

### 3.1 Familias y pesos

| Rol                 | Familia                   | Pesos                                               |
| ------------------- | ------------------------- | --------------------------------------------------- |
| Titulares y nombres | **Newsreader** (serif)    | 400 y cursiva. La cursiva marca lo activo, en lima. |
| Cuerpo e interfaz   | **Hanken Grotesk** (sans) | 400, 500 y 600.                                     |

Carga desde Google Fonts, con la misma URL del prototipo:

```
https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..600&display=swap
```

### 3.2 Escala (según Paleta-Bosque)

| Uso                         | Estilo                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Titular hero                | Newsreader 400, `clamp(54px, 7.4vw, 116px)`, interlineado 0,94                                                 |
| Titular de sección          | Newsreader 400, `clamp(40px, 5vw, 76px)` y `clamp(42px, 5.6vw, 88px)`                                          |
| Declaración de sección      | Newsreader 400, `clamp(34px, 4.7vw, 72px)`, interlineado 1,08                                                  |
| Nombre de sala              | Newsreader 400, `clamp(30px, 3.5vw, 50px)`                                                                     |
| Titular activo              | Newsreader cursiva, 28 px, en lima. Marca el elemento seleccionado de una lista                                |
| Cuerpo                      | Hanken Grotesk 400, 17 px / 26 px                                                                              |
| Interfaz (botones, enlaces) | Hanken Grotesk 500 a 600, 14 a 16 px                                                                           |
| Menú y enlaces              | Hanken Grotesk 500, 15 px, minúsculas con inicial («Para empresas»), sin flechas «→», objetivo táctil de 44 px |
| Etiquetas pequeñas          | Hanken Grotesk 12 a 13 px, solo en la fila bajo el titular                                                     |

Cifras con `font-variant-numeric: tabular-nums`. Tracking de titulares `-0.015em`.

Decisión: la escala es la de `Paleta-Bosque`, con una excepción en el menú y los enlaces. Allí se sigue `referencia-01-landing.html`: minúsculas con inicial a 15 px y sin flechas «→» en botones ni enlaces. Se descartan el menú en mayúsculas de 13 px y las flechas de `Paleta-Bosque`, por legibilidad (las mayúsculas con tildes se leen peor) y para cumplir los 44 px de objetivo táctil. Si algún día se quiere una flecha decorativa, ha de llevar `aria-hidden="true"`.

`referencia-01-landing.html` usa además hero de 52 a 104 px, títulos de 40 a 68 px y etiquetas de 14 px. Esos valores no se aplican.

## 4. Variables CSS

Listas para pegar en el bloque `:root` de `client/styles/style.css`. Ese archivo no se ha tocado.

```css
:root {
  /* Fondos */
  --bosque: #24331f;
  --bosque-elevado: #2f4329;
  --bosque-profundo: #18240f;
  --foto-hueco: #3d5535;

  /* Texto y líneas */
  --crema: #f3ecdc;
  --crema-suave: #c4c9b4;
  --linea: #506a49; /* decorativo, nunca texto */

  /* Acentos */
  --lima: #cfe36a; /* solo activo, seleccionado y foco */
  --bronce: #b8894a;
  --bronce-oscuro: #8a5a24; /* bronce sobre fondo crema */

  /* Estados de sala (siempre con texto; "no se alquila" con trama) */
  --libre: #c3e3b0;
  --libre-texto: #14230f;
  --ocupada: #c64e34;
  --ocupada-texto: #ffffff;
  --no-alquila: #9aa793;
  --no-alquila-texto: #050a03;

  /* Secundarios (plano y edificio) */
  --linea-plano: #5d7656;
  --papel: #fdfaf0;
  --trama-no-alquila: #76846d;
  --bronce-claro: #dcb67a;
  --bronce-borde: #8a6330;
  --bronce-ventana: #6f4f26;

  /* Tipografía */
  --font-display: 'Newsreader', Georgia, serif;
  --font-body: 'Hanken Grotesk', system-ui, sans-serif;
  --text-hero: clamp(54px, 7.4vw, 116px);
  --text-seccion: clamp(40px, 5vw, 76px);
  --text-declaracion: clamp(34px, 4.7vw, 72px);
  --text-sala: clamp(30px, 3.5vw, 50px);
  --text-cuerpo: 17px;
  --text-interfaz: 16px;
  --text-menu: 15px; /* minúsculas con inicial, sin text-transform */
  --leading-hero: 0.94;
  --leading-declaracion: 1.08;
  --leading-cuerpo: 1.53; /* 26 / 17 */
  --tracking-titular: -0.015em;

  /* Formas y distribución (de referencia-01-landing.html) */
  --radio-pildora: 999px;
  --radio-tarjeta: 16px;
  --radio-buscador: 18px;
  --radio-chip: 4px;
  --ancho-max: 1280px;
  --gutter: clamp(20px, 4vw, 56px);
}
```
