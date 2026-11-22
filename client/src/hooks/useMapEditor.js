// Estado y acciones del editor de mapas: salas, selección, dibujar, mover, redimensionar, editar código, nombre y tipo, borrar y deshacer.
// Las salas van en el formato de la API (`{ id, codigo, nombre, tipo, x, y, w, h }`, coordenadas del plano).
// Deshacer guarda una copia de las salas antes de cada cambio terminado: un arrastre entero es un solo paso (se llama
// a `checkpoint()` al empezar y a `changeRoom(..., { record: false })` mientras dura), y cada pulsación de teclado es
// otro. `dirty` dice si hay cambios sin guardar desde la última carga o el último guardado.
import { useCallback, useMemo, useReducer } from 'react';
import { BLANK_MAP } from '@/utils/mapGeometry.js';

const MAX_HISTORY = 100;

// Código siguiente para una sala nueva: S-01, S-02… (sigue al más alto que ya haya con ese formato).
function nextNumber(salas) {
  const used = salas
    .map((s) => /^S-(\d+)$/.exec(s.codigo ?? '')?.[1])
    .filter(Boolean)
    .map(Number);
  return (used.length > 0 ? Math.max(...used) : 0) + 1;
}

// Sala nueva. El id tiene que ser único en toda la base de datos (es el id de su documento en `rooms`; si se repite,
// la API responde 409 ROOM_ID_TAKEN), por eso es aleatorio. Código, nombre y tipo se editarán en el panel (EMP009).
function newRoom(rect, salas) {
  const n = nextNumber(salas);
  return {
    id: `s-${crypto.randomUUID()}`,
    codigo: `S-${String(n).padStart(2, '0')}`,
    nombre: `Sala ${n}`,
    tipo: 'sala',
    ...rect,
  };
}

const initialState = {
  plan: BLANK_MAP,
  salas: [],
  selectedId: null,
  tool: 'select',
  past: [],
  dirty: false,
};

function record(state) {
  return { past: [...state.past, state.salas].slice(-MAX_HISTORY), dirty: true };
}

function reducer(state, action) {
  switch (action.type) {
    case 'load': {
      const plan = { ancho: action.map.ancho, alto: action.map.alto };
      // Las salas se cargan tal cual: abrir y guardar sin tocar nada no cambia el mapa.
      const salas = action.map.salas ?? [];
      return { ...initialState, plan, salas };
    }
    case 'tool':
      return {
        ...state,
        tool: action.tool,
        selectedId: action.tool === 'draw' ? null : state.selectedId,
      };
    case 'select':
      return { ...state, selectedId: action.id };
    case 'checkpoint':
      return { ...state, ...record(state) };
    case 'add': {
      const room = newRoom(action.rect, state.salas);
      return {
        ...state,
        ...record(state),
        salas: [...state.salas, room],
        selectedId: room.id,
        tool: 'select',
      };
    }
    case 'change': {
      const salas = state.salas.map((s) => (s.id === action.id ? { ...s, ...action.rect } : s));
      return action.record
        ? { ...state, ...record(state), salas }
        : { ...state, salas, dirty: true };
    }
    case 'delete': {
      if (!state.salas.some((s) => s.id === action.id)) return state;
      return {
        ...state,
        ...record(state),
        salas: state.salas.filter((s) => s.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };
    }
    case 'undo': {
      if (state.past.length === 0) return state;
      const salas = state.past.at(-1);
      return {
        ...state,
        salas,
        past: state.past.slice(0, -1),
        selectedId: salas.some((s) => s.id === state.selectedId) ? state.selectedId : null,
        dirty: true,
      };
    }
    case 'saved':
      return { ...state, dirty: false };
    default:
      return state;
  }
}

export function useMapEditor() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const load = useCallback((map) => dispatch({ type: 'load', map }), []);
  const actions = useMemo(
    () => ({
      setTool: (tool) => dispatch({ type: 'tool', tool }),
      select: (id) => dispatch({ type: 'select', id }),
      checkpoint: () => dispatch({ type: 'checkpoint' }),
      addRoom: (rect) => dispatch({ type: 'add', rect }),
      changeRoom: (id, rect, { record: rec = true } = {}) =>
        dispatch({ type: 'change', id, rect, record: rec }),
      // Código, nombre o tipo de una sala (panel de sala). Igual que changeRoom: al escribir, `checkpoint()` al
      // empezar y `{ record: false }` en cada tecla, para que deshacer quite el texto entero de una vez.
      updateRoomInfo: (id, fields, { record: rec = true } = {}) =>
        dispatch({ type: 'change', id, rect: fields, record: rec }),
      deleteRoom: (id) => dispatch({ type: 'delete', id }),
      undo: () => dispatch({ type: 'undo' }),
      markSaved: () => dispatch({ type: 'saved' }),
    }),
    [],
  );

  const selected = state.salas.find((s) => s.id === state.selectedId) ?? null;

  return {
    ...state,
    selected,
    canUndo: state.past.length > 0,
    load,
    ...actions,
  };
}
