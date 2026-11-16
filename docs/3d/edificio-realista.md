## Decidido (v3 — realista profesional)

### Base
- Estructura de la versión anterior al rediseño "mockup".
  - Plantas: las de heroBuildingData.js original, con planta-5 y planta-6 restauradas.
  - Planta baja más alta con vestíbulo y marquesina.
  - Núcleo vertical que sobresale por la cubierta.
  - Cubierta y entorno ligero.
- Colores: solo tokens Bosque, sin colores nuevos. Los colores de estado no cambian.

### Arquitectura (lo que lo hace "edificio")
- Forjado con canto visible (~0,3 m) y banda de antepecho opaca en cada planta: el ritmo horizontal es lo que hace que se lea como oficinas.
- Muro cortina:
  - Montantes cada ~1,5 m y travesaño a media altura.
  - Perfiles con profundidad real (~5 cm de relieve), no líneas planas.
- Esquinas: pilares en las esquinas o retranqueo del vidrio respecto al forjado (~20 cm) para dar sombra y profundidad.
- Planta baja:
  - Doble altura, más transparente y con puerta de entrada visible.
  - Marquesina con canto fino.
- Núcleo: macizo, en un tono de la paleta, con lamas o una franja vertical de ventanas pequeñas.
- Cubierta: peto, 2–3 máquinas con rejilla, caseta del núcleo y una barandilla fina.
- Escala humana: barandillas, puerta y algún banco o farola en la acera. Árboles low-poly mínimos (2–3), en verde de la paleta.

### Materiales
- MeshStandardMaterial y MeshPhysicalMaterial (PBR) con environment map.
- Vidrio:
  - MeshPhysicalMaterial con roughness ~0.05, metalness 0, envMapIntensity alta y opacidad ~0.25–0.35.
  - Refleja el entorno y deja intuir el interior.
- Interior visible tras el vidrio:
  - Suelo de cada planta con el color de estado atenuado.
  - Siluetas simples de mesas o tabiques bajos, en InstancedMesh.
- Hormigón y perfiles con roughness 0.6–0.9. Nada brillante salvo el vidrio.
- Bisel en todos los cantos (RoundedBox o bevel de ~2 cm).

### Luz y render
- Environment de drei (preset city o apartment) con intensidad baja.
- DirectionalLight cálida con sombras PCFSoft (mapSize 2048) y una luz de relleno fría.
- Oclusión ambiental: N8AO o SSAO de postprocessing, si ya está instalado; si no, avisar antes de instalar.
- ContactShadows en la base.
- ACESFilmic toneMapping, sRGB y antialias.
- Exposición ajustada para que el lima y el crema no se quemen.

### Cámara y tamaño
- Perspectiva con FOV ~30 (poca deformación, aspecto de render de arquitectura).
- 3/4 picado, ~25–30°.
- Ocupa ~70 % de la altura dentro de la columna derecha del hero, sin pisar el texto.

### Interacción (se mantiene lo ya hecho)
- Hover: el suelo de la planta se pinta con su color de estado.
- Selección de planta: las plantas de encima suben y se desvanecen, y la fachada de esa planta se oculta.
- Vista de la planta abierta: salas planas, etiquetas «2.01 · Libre», sala elegida en lima y ficha.
- Al cerrar, todo vuelve con una animación suave (~400 ms).

### Rendimiento
- InstancedMesh para montantes, mesas y rejillas.
- <150 draw calls y dpr máximo de 2.
- Sin modelos externos: todo procedural.

### Ajustes finales

#### Techo de la planta 5
- La planta 5 tiene que quedar cerrada por arriba:
  - Forjado de techo con el mismo canto (~0,3 m).
  - Peto perimetral en la parte que queda al aire por el retranqueo de la planta 6.
- Si esa parte es terraza, lleva suelo de terraza, peto y una barandilla fina.
- Ninguna planta deja ver su interior desde arriba si no está abierta.

#### Selección de planta: despiece (sustituye al fundido)
- Al seleccionar la planta N:
  - Las plantas N+1 en adelante, con la cubierta incluida, suben juntas como un bloque unos 1,5–2 alturas de planta.
  - Siguen 100 % opacas, sin fundido ni desaparición.
  - Las plantas por debajo de N se quedan en su sitio, opacas.
  - La planta N muestra el interior: se oculta solo su fachada y su techo, con salas planas, etiquetas, lima y ficha como ahora.
- Animación: ~450 ms con easing (easeInOutCubic o damp de maath/drei), tanto al abrir como al cerrar.
- Al cambiar de N a M, el bloque superior se recoloca sin cerrar antes.
- Cámara: encuadra la planta N y deja visible parte del bloque levantado para dar contexto.
- Sombras: el bloque levantado sigue proyectando sombra sobre la planta N, suave para que no oscurezca las salas.
- Interacción:
  - Con una planta abierta, el bloque levantado no captura clics de sala.
  - Clic en el bloque levantado o en una planta inferior: abre esa planta.