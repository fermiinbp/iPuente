// Página del editor de mapas de una planta: subir plano, detectar, corregir, guardar y publicar (wireframe 13).
// Pantalla completa, fuera de DashboardLayout, con cabecera propia: «← Mis edificios», «Edificio · Planta», estado,
// «Guardar borrador» y «Publicar planta» (desactivado hasta EMP010). Debajo: herramientas (EditorToolbar), lienzo
// (MapEditor) y un panel con la sala seleccionada o, sin selección, la lista de salas para elegir una.
// En pantallas de menos de 900 px no se edita: se avisa de que el editor se usa en pantallas grandes.
//
// Carga: el edificio y la planta salen de GET /company/buildings, y el mapa de getFloorMap. La API TODAVÍA NO TIENE
// el endpoint para leer el mapa de una planta en borrador (docs/back-pendiente-emp.md, EMP007): mientras no exista,
// se avisa de que se implementará más adelante y se empieza con el plano en blanco. Como guardar sustituye el mapa
// entero, si la planta ya tiene salas «Guardar borrador» se desactiva para no borrarlas.
// Fuera de esta issue: subir el plano y la IA (EMP008), editar los datos de la sala (EMP009) y publicar (EMP010).
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import Alert from '@/components/ui/Alert/Alert.jsx';
import BackLink from '@/components/ui/BackLink/BackLink.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import ConfirmModal from '@/components/ui/ConfirmModal/ConfirmModal.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge.jsx';
import EditorToolbar from '@/components/map-editor/EditorToolbar/EditorToolbar.jsx';
import MapEditor from '@/components/map-editor/MapEditor/MapEditor.jsx';
import { PUBLISH_STATUS } from '@/config/constants.js';
import { useFetch } from '@/hooks/useFetch.js';
import { useMapEditor } from '@/hooks/useMapEditor.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { getBuildings, getFloorMap, saveFloorMap } from '@/services/companyService.js';
import { BLANK_MAP } from '@/utils/mapGeometry.js';
import styles from './MapEditorPage.module.css';

const TYPE_LABELS = {
  sala: 'Sala',
  box: 'Box',
  comun: 'Zona común',
  cocina: 'Cocina',
  pasillo: 'Pasillo',
};

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Edificio, planta y mapa a la vez. Si la planta no está en el listado de la empresa: 404.
async function loadFloor(floorId, signal) {
  const [buildings, map] = await Promise.all([
    getBuildings({ signal }),
    getFloorMap(floorId, { signal }),
  ]);
  for (const building of buildings) {
    const floor = building.plantas?.find((p) => p.id === floorId);
    if (floor) return { building, floor, map };
  }
  const error = new Error('No encontramos esta planta.');
  error.status = 404;
  throw error;
}

// ¿Está el foco en un campo de texto? (los atajos de teclado no deben saltar mientras se escribe)
const typing = (target) => target?.closest?.('input, textarea, select, [contenteditable="true"]');

function RoomPanel({ editor }) {
  const { selected, salas } = editor;

  if (selected) {
    return (
      <div className={styles.panelBody}>
        <h2 className={styles.panelTitle}>Sala seleccionada</h2>
        <dl className={styles.facts}>
          <div>
            <dt>Código</dt>
            <dd>{selected.codigo}</dd>
          </div>
          <div>
            <dt>Nombre</dt>
            <dd>{selected.nombre}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{TYPE_LABELS[selected.tipo] ?? selected.tipo}</dd>
          </div>
          <div>
            <dt>Posición y tamaño</dt>
            <dd>
              {selected.x}, {selected.y} · {selected.w} × {selected.h}
            </dd>
          </div>
        </dl>
        <p className={styles.panelNote}>
          El código, el nombre, el tipo y los datos para el cliente se editarán aquí próximamente.
        </p>
        <Button variant="secondary" size="md" onClick={() => editor.deleteRoom(selected.id)}>
          Eliminar sala
        </Button>
        <p className={styles.panelNote}>
          Con teclado: flechas para mover, Mayús + flechas para cambiar el tamaño, Supr para borrar
          y Escape para soltarla.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.panelBody}>
      <h2 className={styles.panelTitle}>Salas del plano</h2>
      {salas.length === 0 ? (
        <p className={styles.panelNote}>
          Todavía no hay salas. Elige «Dibujar sala» y arrastra sobre el plano para crear una.
        </p>
      ) : (
        <>
          <p className={styles.panelNote}>Elige una para seleccionarla.</p>
          <ul className={styles.roomList}>
            {salas.map((room) => (
              <li key={room.id}>
                <button
                  type="button"
                  className={styles.roomButton}
                  onClick={() => {
                    editor.setTool('select');
                    editor.select(room.id);
                    document.querySelector(`[data-room-id="${room.id}"]`)?.focus();
                  }}
                >
                  <span className={styles.roomCode}>{room.codigo}</span> {room.nombre}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Editor({ building, floor, map }) {
  const navigate = useNavigate();
  const editor = useMapEditor();
  const { load } = editor;
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [leaving, setLeaving] = useState(false);

  const mapAvailable = map.disponible;
  // Sin el endpoint no se sabe qué salas tiene: guardar el plano en blanco las borraría.
  const locked = !mapAvailable && floor.salas > 0;

  useEffect(() => {
    load(
      mapAvailable && map.ancho && map.alto
        ? { ancho: map.ancho, alto: map.alto, salas: map.salas ?? [] }
        : { ...BLANK_MAP, salas: [] },
    );
  }, [load, map, mapAvailable]);

  // Atajos: Ctrl/Cmd+Z deshace, V selecciona, R dibuja y Escape deja de dibujar.
  const { undo, setTool, tool } = editor;
  useEffect(() => {
    const onKey = (event) => {
      if (typing(event.target) || document.querySelector('[role="dialog"]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
      } else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        if (event.key === 'v' || event.key === 'V') setTool('select');
        else if (event.key === 'r' || event.key === 'R') setTool('draw');
        else if (event.key === 'Escape' && tool === 'draw') setTool('select');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [undo, setTool, tool]);

  // Avisar al cerrar o recargar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!editor.dirty) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [editor.dirty]);

  const save = async () => {
    setSaving(true);
    setResult(null);
    try {
      await saveFloorMap(floor.id, {
        ancho: editor.plan.ancho,
        alto: editor.plan.alto,
        origen: map.origen ?? 'manual',
        salas: editor.salas,
      });
      editor.markSaved();
      setResult({ type: 'success', text: 'Borrador guardado.' });
    } catch (error) {
      const details = Array.isArray(error?.details) ? error.details.map((d) => d.message) : [];
      setResult({
        type: 'error',
        text:
          error?.code === 'ROOM_ID_TAKEN'
            ? 'Una de las salas tiene un identificador que ya usa otra planta. Bórrala y dibújala de nuevo.'
            : error?.message || 'No hemos podido guardar el borrador.',
        details,
      });
    } finally {
      setSaving(false);
    }
  };

  const goBack = (event) => {
    if (!editor.dirty) return;
    event.preventDefault();
    setLeaving(true);
  };

  const title = `${building.nombre} · ${floor.nombre}`;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <BackLink to="/company/buildings" onClick={goBack}>
          Mis edificios
        </BackLink>
        <h1 className={styles.title}>{title}</h1>
        <StatusBadge
          kind="publish"
          status={floor.publicado ? PUBLISH_STATUS.PUBLISHED : PUBLISH_STATUS.DRAFT}
        />
        {editor.dirty && <span className={styles.unsaved}>Cambios sin guardar</span>}
        <div className={styles.headerActions}>
          <Button
            variant="secondary"
            size="md"
            loading={saving}
            disabled={locked || !editor.dirty}
            onClick={save}
          >
            Guardar borrador
          </Button>
          {/* TODO(EMP010): comprobar y publicar la planta. */}
          <Button size="md" disabled aria-describedby="publicar-pronto">
            Publicar planta
          </Button>
          <span id="publicar-pronto" className={styles.srOnly}>
            Próximamente
          </span>
        </div>
      </header>

      <div className={styles.mobileNotice}>
        <h2 className={styles.mobileTitle}>El editor se usa en pantallas grandes</h2>
        <p>Abre esta página en un ordenador o una tableta en horizontal para dibujar las salas.</p>
        <Button variant="secondary" to="/company/buildings">
          Volver a Mis edificios
        </Button>
      </div>

      <div className={styles.workspace}>
        <div className={styles.messages}>
          {!mapAvailable && (
            <Alert
              type={locked ? 'warning' : 'info'}
              title="La carga del mapa guardado se implementará más adelante"
            >
              {locked
                ? `La API todavía no permite leer el mapa de una planta en borrador. Esta planta ya tiene ${plural(floor.salas, 'sala', 'salas')}: para no borrarlas, «Guardar borrador» está desactivado. Puedes probar el editor, pero los cambios no se guardarán.`
                : 'La API todavía no permite leer el mapa de una planta en borrador, así que se empieza con el plano en blanco. Esta planta no tiene salas: puedes dibujarlas y guardar.'}
            </Alert>
          )}
          {result && (
            <Alert type={result.type}>
              {result.text}
              {result.details?.length > 0 && (
                <ul className={styles.details}>
                  {result.details.slice(0, 5).map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </Alert>
          )}
        </div>

        <div className={styles.layout}>
          <EditorToolbar
            tool={editor.tool}
            onTool={editor.setTool}
            canDelete={Boolean(editor.selected)}
            onDelete={() => editor.selected && editor.deleteRoom(editor.selected.id)}
            canUndo={editor.canUndo}
            onUndo={editor.undo}
          />
          <div className={styles.canvasArea}>
            <MapEditor
              editor={editor}
              imageUrl={map.mapImageUrl ?? null}
              label={`Plano de ${title}`}
            />
            <p className={styles.hint}>
              {editor.tool === 'draw'
                ? 'Arrastra sobre el plano para dibujar una sala. Escape para dejar de dibujar.'
                : 'Pulsa una sala para seleccionarla, arrástrala para moverla y usa sus esquinas para cambiar el tamaño.'}
            </p>
          </div>
          <aside className={styles.panel} aria-label="Sala">
            <RoomPanel editor={editor} />
          </aside>
        </div>
      </div>

      <ConfirmModal
        open={leaving}
        onClose={() => setLeaving(false)}
        title="¿Salir sin guardar?"
        text="Tienes cambios en el plano que no se han guardado. Si sales, se perderán."
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        onConfirm={() => {
          editor.markSaved();
          navigate('/company/buildings');
        }}
      />
    </div>
  );
}

export default function MapEditorPage() {
  const { floorId } = useParams();
  const { data, error, loading, reload } = useFetch(
    (signal) => loadFloor(floorId, signal),
    `floor-editor-${floorId}`,
  );
  usePageTitle(
    data ? `Editor · ${data.building.nombre} · ${data.floor.nombre}` : 'Editor de mapas',
  );

  if (loading) {
    return (
      <div className={styles.center}>
        <Spinner label="Cargando el editor…" />
      </div>
    );
  }
  if (error?.status === 404) {
    return (
      <div className={styles.center}>
        <ErrorState
          title="No encontramos esta planta"
          actions={
            <Button variant="secondary" to="/company/buildings">
              Volver a Mis edificios
            </Button>
          }
        >
          Puede que se haya eliminado o que no sea de tu empresa.
        </ErrorState>
      </div>
    );
  }
  if (error) {
    return (
      <div className={styles.center}>
        <ErrorState error={error} title="No hemos podido abrir el editor" onRetry={reload} />
        <Link className={styles.backText} to="/company/buildings">
          Volver a Mis edificios
        </Link>
      </div>
    );
  }
  return <Editor key={floorId} {...data} />;
}
