// Lienzo del editor: plano de fondo y salas editables encima.
// Es un <svg> con viewBox = tamaño del plano (`plan.ancho` × `plan.alto`), así se escala solo al ancho disponible y
// todo se calcula en coordenadas del plano (utils/mapGeometry.js). El plano subido (`imageUrl`) va de fondo,
// semitransparente; sin plano, se ve la rejilla.
// Herramientas (`tool`): 'select' (pulsar una sala la selecciona, arrastrarla la mueve, las esquinas la
// redimensionan; pulsar el fondo quita la selección) y 'draw' (arrastrar sobre el plano crea una sala nueva).
// Recibe el estado y las acciones de useMapEditor (`editor`). Un arrastre entero es un solo paso de deshacer.
import { useRef, useState } from 'react';
import RoomHandle from '@/components/map-editor/RoomHandle/RoomHandle.jsx';
import {
  GRID,
  growRect,
  isBigEnough,
  moveRect,
  rectFromPoints,
  resizeRect,
  toPlanPoint,
} from '@/utils/mapGeometry.js';
import styles from './MapEditor.module.css';

const pick = ({ x, y, w, h }) => ({ x, y, w, h });

export default function MapEditor({ editor, imageUrl, label }) {
  const { plan, salas, selectedId, tool } = editor;
  const svgRef = useRef(null);
  const drag = useRef(null);
  const [preview, setPreview] = useState(null);
  // Tiradores de unos 12 px de pantalla, sea cual sea el tamaño del plano.
  const handleSize = Math.max(plan.ancho, plan.alto) / 80;

  const point = (event) => toPlanPoint(svgRef.current, event.clientX, event.clientY);

  const start = (event, state) => {
    if (event.button !== 0) return;
    event.preventDefault();
    svgRef.current.setPointerCapture(event.pointerId);
    drag.current = { ...state, from: point(event), changed: false };
  };

  const onBackgroundDown = (event) => {
    if (tool === 'draw') start(event, { type: 'draw' });
    else if (event.target === svgRef.current || event.target.dataset.background)
      editor.select(null);
  };

  const onRoomDown = (event, room) => {
    if (tool !== 'select') return;
    event.stopPropagation();
    editor.select(room.id);
    start(event, { type: 'move', id: room.id, original: pick(room) });
  };

  const onCornerDown = (event, room, corner) => {
    start(event, { type: 'resize', id: room.id, corner, original: pick(room) });
  };

  const onPointerMove = (event) => {
    const current = drag.current;
    if (!current) return;
    const to = point(event);
    if (current.type === 'draw') {
      setPreview(rectFromPoints(current.from, to, plan));
      return;
    }
    const dx = to.x - current.from.x;
    const dy = to.y - current.from.y;
    // Un clic sin mover no cuenta como cambio (ni crea un paso de deshacer).
    if (!current.changed) {
      if (Math.abs(dx) < GRID / 2 && Math.abs(dy) < GRID / 2) return;
      editor.checkpoint();
      current.changed = true;
    }
    const rect =
      current.type === 'move'
        ? moveRect(current.original, dx, dy, plan)
        : resizeRect(current.original, current.corner, to, plan);
    editor.changeRoom(current.id, rect, { record: false });
  };

  const onPointerUp = (event) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    if (svgRef.current.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
    if (current.type === 'draw') {
      const rect = rectFromPoints(current.from, point(event), plan);
      setPreview(null);
      if (isBigEnough(rect)) editor.addRoom(rect);
    }
  };

  const onPointerCancel = () => {
    drag.current = null;
    setPreview(null);
  };

  return (
    <div className={styles.frame}>
      <svg
        ref={svgRef}
        className={`${styles.canvas} ${tool === 'draw' ? styles.drawing : ''}`}
        viewBox={`0 0 ${plan.ancho} ${plan.alto}`}
        role="group"
        aria-label={label}
        onPointerDown={onBackgroundDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <defs>
          <pattern
            id="rejilla-editor"
            width={GRID * 5}
            height={GRID * 5}
            patternUnits="userSpaceOnUse"
          >
            <path d={`M ${GRID * 5} 0 L 0 0 0 ${GRID * 5}`} className={styles.gridLine} />
          </pattern>
        </defs>
        <rect
          className={styles.paper}
          width={plan.ancho}
          height={plan.alto}
          data-background="true"
        />
        {imageUrl ? (
          <image
            className={styles.plan}
            href={imageUrl}
            width={plan.ancho}
            height={plan.alto}
            preserveAspectRatio="none"
            data-background="true"
          />
        ) : (
          <rect
            width={plan.ancho}
            height={plan.alto}
            fill="url(#rejilla-editor)"
            data-background="true"
          />
        )}

        {salas.map((room) => (
          <RoomHandle
            key={room.id}
            room={room}
            selected={room.id === selectedId}
            handleSize={handleSize}
            onSelect={() => editor.select(room.id)}
            onDeselect={() => editor.select(null)}
            onPointerDownBody={onRoomDown}
            onPointerDownCorner={onCornerDown}
            onMove={(dx, dy) => editor.changeRoom(room.id, moveRect(pick(room), dx, dy, plan))}
            onGrow={(dw, dh) => editor.changeRoom(room.id, growRect(pick(room), dw, dh, plan))}
            onDelete={() => editor.deleteRoom(room.id)}
          />
        ))}

        {preview && (
          <rect
            className={`${styles.preview} ${isBigEnough(preview) ? '' : styles.tooSmall}`}
            x={preview.x}
            y={preview.y}
            width={preview.w}
            height={preview.h}
          />
        )}
      </svg>
    </div>
  );
}
