# Spec mockup cliente iPuente (Bosque)

## Tokens
Fondo #24331f · elevado #2f4329 · profundo #18240f · crema #f3ecdc · crema suave #c4c9b4
Líneas #506a49 · lima #cfe36a (solo activo/foco) · bronce #b8894a
Libre #c3e3b0/#14230f · Ocupada #c64e34/#fff · No se alquila #9aa793/#050a03 + trama
Tipos: Newsreader (titulares, cursiva en activo) + Hanken Grotesk
Logo: «i-puente» (marca + wordmark Newsreader, <em>i</em>Puente)

## Pantallas cliente
01 Landing (hero, buscador, salas destacadas + filtros, ¿Tienes oficinas?, footer)
02 Edificio (3D/imagen con plantas clicables, Qué hay cerca, mapa)
03 Planta (plano cenital, sala seleccionada elevada, leyenda de estados)
04 Ficha de sala (galería, capacidad, equipamiento, precio, calendario, CTA reservar)
05 Login · 06 Registro
07 Resumen y pago · 08 Stripe (prueba) · 09 Resultado pago (OK / KO)
10 Mis reservas (próximas, pasadas, cancelar)
11 404

## Checklist por pantalla (obligatoria)
- Frames: Desktop 1440 + Mobile 390
- Estados: normal, vacío, cargando (skeleton), error, éxito
- Interacción: hover, foco (lima), deshabilitado, seleccionado
- Overlays: modales, toasts, menú móvil, dropdowns abiertos
- Header con y sin sesión iniciada
- Textos reales en español (nada de lorem)
- Contraste AA; el estado de una sala nunca solo por color

## Reglas Figma
- 1 página Figma por pantalla, nombrada «NN · Nombre»
- Página «00 · Foundations»: variables de color, estilos de texto, componentes
- Auto Layout en todo; capas con nombre; usar componentes e instancias (nada de grupos sueltos)
- Variantes de componente para los estados (Button/Primary/Hover…)