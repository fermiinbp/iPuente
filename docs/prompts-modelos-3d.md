# Modelos 3D para la visita del edificio: fuentes y prompts

Apoya a `docs/plan-visita-3d.md` (fase F2). Las fuentes y sus licencias están escritas de memoria y **no se han comprobado una por una**: verifica la licencia de cada modelo antes de usarlo.

## 1. Dónde conseguir modelos `.glb`

| Fuente                                                    | Qué tiene                                                   | Licencia típica                                                         |
| --------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Kenney** (kenney.nl, packs «Furniture Kit» y similares) | Muebles y objetos low-poly muy limpios                      | CC0                                                                     |
| **Quaternius** (quaternius.com)                           | Packs de muebles, oficina y props en glTF                   | CC0                                                                     |
| **Poly Pizza** (poly.pizza)                               | Buscador de miles de props low-poly                         | CC0 y CC-BY, según el modelo                                            |
| **Sketchfab**                                             | El mayor catálogo; filtra por _Downloadable_ y por licencia | Mezcla: usar **CC0 o CC-BY**, evitar las **NC** (no comercial) y **ND** |
| **Poly Haven** (polyhaven.com)                            | Modelos de alta calidad                                     | CC0, pero suelen ser demasiado pesados para web                         |

**Recomendación:** sacar la mayoría de las piezas (sillas, mesas, sofá, plantas, impresora, estanterías) de Kenney y Quaternius, que son low-poly coherentes entre sí y CC0, y reservar la IA para las piezas propias de iPuente: la maqueta del puente colgante del logo para el vestíbulo y el mostrador de recepción.

## 2. Generadores de IA para 3D

- **Meshy**, **Tripo** y **Rodin (Hyper3D)**: de texto o imagen a modelo `.glb`. Tripo suele dar geometría más limpia.
- **Hunyuan3D** y **TRELLIS**: de código abierto, para probar sin pagar.
- Funcionan bien con **un objeto aislado**; las escenas completas salen mal.
- La malla suele salir desordenada, con triángulos de más y texturas pesadas: contar con limpiarla en Blender.

## 3. Requisitos técnicos (de la skill `modelado-3d-web`)

- Menos de 5 000 triángulos por pieza y menos de 300 KB cada `.glb`.
- 1 unidad = 1 metro, orientación Y arriba, origen en la base y transformaciones aplicadas.
- Un solo material o un atlas de 1024 px como máximo.
- Partes móviles como nodos separados (puertas del ascensor, asiento giratorio).

## 4. Prompt base (en inglés, funciona mejor)

Cambiar `[OBJETO]` por cada pieza de la lista:

```
Low-poly stylized 3D prop for a web 3D scene: [OBJETO]. Clean simple geometry,
faceted flat-shaded look with soft bevels, matte materials, one flat colour palette:
muted forest green (#24331f, #2f4329), cream (#f3ecdc), bronze accent (#b8894a).
Single object centered at the origin, standing on the ground, facing +Z,
real-world scale in meters, under 5000 triangles, watertight clean topology,
no text, no logos, no background, no floor, no baked shadows.
```

**Prompt negativo:**

```
photorealistic, high poly, noisy details, text, logo, background, multiple objects,
glass, transparency, thin floating parts, clutter
```

## 5. Lista de piezas

1. `office chair with swivel seat as a separate node, 0.6 x 0.6 x 0.95 m`
2. `meeting table for 8 people, rounded rectangle top, 2.4 x 1.1 x 0.75 m`
3. `desk with a flat monitor, keyboard and mouse, 1.4 x 0.7 x 0.75 m`
4. `whiteboard on a stand, 1.2 x 0.9 m`
5. `three-seat sofa, 2.0 x 0.9 x 0.8 m`
6. `potted ficus plant in a bronze pot, 1.2 m tall`
7. `office laser printer on a small cabinet`
8. `water cooler and coffee machine on a counter`
9. `elevator doors with frame, two sliding doors as separate nodes, 1.1 x 2.2 m`
10. `reception desk, curved front, with a small bronze sign`
11. `tall bookshelf with generic books, no readable titles`
12. `pendant lamp, simple cone shade`
13. **Pieza de marca:** `miniature suspension bridge sculpture on a plinth, two towers, thin cables and hangers, small square bronze cabin on the deck, 0.6 m wide`

## 6. Después de generar

1. En Blender: reducir triángulos, recolorear con la paleta, comprobar escala y origen.
2. Optimizar con `npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-resize 512` (se ejecuta con `npx`, sin instalar nada en el proyecto; avisar antes de hacerlo).
3. Guardar en `client/public/models/` y anotar autor, enlace y licencia en `docs/licencias-modelos.md`.
4. Cargarlos con `useGLTF` de `@react-three/drei`, que ya está instalado.

## 7. Notas

- Los generadores de IA gastan créditos de la cuenta que se use: no se lanza ninguno sin que lo pida quien lleve el proyecto.
- Si se aportan modelos `.glb` ya hechos, la fase F2 del plan se acorta unas horas.
