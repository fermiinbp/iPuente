// Página del editor de mapas de una planta: subir plano, detectar, corregir, guardar y publicar (wireframe 13).
// Pantalla completa, fuera de DashboardLayout, con cabecera propia: «← Mis edificios», «Edificio · Planta», estado,
// «Guardar borrador» y «Publicar planta» (desactivado hasta EMP010). Debajo: herramientas (EditorToolbar), lienzo
// (MapEditor) y un panel con la sala seleccionada (RoomPropertiesPanel) o, sin selección, la lista de salas.
// En pantallas de menos de 900 px no se edita: se avisa de que el editor se usa en pantallas grandes.
//
// Carga: el edificio y la planta salen de GET /company/buildings, y el mapa de getFloorMap. La API TODAVÍA NO TIENE
// el endpoint para leer el mapa de una planta en borrador (docs/back-pendiente-emp.md, EMP007): mientras no exista,
// se avisa de que se implementará más adelante y se empieza con el plano en blanco. Como guardar sustituye el mapa
// entero, si la planta ya tiene salas «Guardar borrador» se desactiva para no borrarlas.
//
// Panel de sala (EMP009): código, nombre y tipo van con el mapa; los datos para el cliente (precio, personas, m²,
// equipamiento y «reservable») se guardan con PATCH /company/rooms/:id. Un solo «Guardar borrador»: primero el mapa
// y después los datos de las salas que han cambiado (así también las recién dibujadas, que ya existen en la API). Si
// falla alguna sala se dice cuál y sus cambios se quedan para reintentar. Eliminar una sala ya guardada comprueba sus
// reservas futuras: si tiene, no se elimina (hay que cancelarlas antes en Reservas).
// Fuera: subir el plano y la IA (EMP008), las fotos de la sala (EMP012) y publicar (EMP010).
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
import RoomPropertiesPanel from '@/components/map-editor/RoomPropertiesPanel/RoomPropertiesPanel.jsx';
import UnsavedChangesModal from '@/components/map-editor/UnsavedChangesModal/UnsavedChangesModal.jsx';
import { PUBLISH_STATUS } from '@/config/constants.js';
import { useFetch } from '@/hooks/useFetch.js';
import { useMapEditor } from '@/hooks/useMapEditor.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import {
  getBuildings,
  getFloorMap,
  getRoomFutureBookings,
  getRooms,
  saveFloorMap,
  updateRoom,
} from '@/services/companyService.js';
import { BLANK_MAP } from '@/utils/mapGeometry.js';
import {
  EMPTY_DATA,
  dataFromApi,
  hasClientData,
  patchFor,
  roomInfoErrors,
  savedData,
  validateData,
} from '@/utils/roomData.js';
import styles from './MapEditorPage.module.css';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Edificio, planta, mapa y salas de la planta (con sus datos para el cliente). Si la planta no está en el listado de
// la empresa: 404.
async function loadFloor(floorId, signal) {
  const [buildings, map] = await Promise.all([
    getBuildings({ signal }),
    getFloorMap(floorId, { signal }),
  ]);
  for (const building of buildings) {
    const floor = building.plantas?.find((p) => p.id === floorId);
    if (floor) {
      const rooms = await getRooms({ floorId }, { signal });
      return { building, floor, map, rooms: Array.isArray(rooms) ? rooms : [] };
    }
  }
  const error = new Error('No encontramos esta planta.');
  error.status = 404;
  throw error;
}

// ¿Está el foco en un campo de texto? (los atajos de teclado no deben saltar mientras se escribe)
const typing = (target) => target?.closest?.('input, textarea, select, [contenteditable="true"]');

function RoomPanel({
  editor,
  dataOf,
  baseOf,
  onDataChange,
  onDelete,
  deletingId,
  onUploadingChange,
}) {
  const { selected, salas } = editor;

  if (selected) {
    return (
      <RoomPropertiesPanel
        key={selected.id}
        room={selected}
        onRoomChange={(fields, options) => editor.updateRoomInfo(selected.id, fields, options)}
        onCheckpoint={editor.checkpoint}
        data={dataOf(selected.id)}
        base={baseOf(selected.id)}
        onDataChange={(data) => onDataChange(selected.id, data)}
        onDelete={() => onDelete(selected.id)}
        deleting={deletingId === selected.id}
        onUploadingChange={onUploadingChange}
      />
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

// Confirmación de eliminar una sala guardada (wireframe 13g, derecha), según sus reservas futuras.
function DeleteRoomModal({ state, onClose, onRetry, onConfirm }) {
  const { room, count, error } = state;
  const name = room.codigo || room.nombre || 'esta sala';
  if (error) {
    return (
      <ConfirmModal
        open
        onClose={onClose}
        title={`¿Eliminar ${name}?`}
        text="No hemos podido comprobar si tiene reservas futuras. Inténtalo de nuevo."
        confirmLabel="Reintentar"
        onConfirm={onRetry}
      />
    );
  }
  if (count > 0) {
    return (
      <ConfirmModal
        open
        onClose={onClose}
        title={`No se puede eliminar ${name}`}
        text={`Tiene ${plural(count, 'reserva futura', 'reservas futuras')}. Cancélalas antes en «Reservas» y vuelve a intentarlo.`}
        confirmLabel="Entendido"
        onConfirm={onClose}
      />
    );
  }
  return (
    <ConfirmModal
      open
      onClose={onClose}
      title={`¿Eliminar ${name}?`}
      text="Se quita del plano y, cuando guardes el borrador, dejará de poder reservarse. Hasta entonces puedes deshacerlo."
      confirmLabel="Eliminar sala"
      onConfirm={onConfirm}
    />
  );
}

function Editor({ building, floor, map, rooms }) {
  const navigate = useNavigate();
  const editor = useMapEditor();
  const { load } = editor;
  const [saving, setSaving] = useState(false);
  // Fotos subiéndose a Storage: no se guarda hasta que terminen (si no, se quedarían fuera).
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [result, setResult] = useState(null);
  const [leaving, setLeaving] = useState(false);
  // Datos para el cliente: los guardados en la API (`base`, por id de sala) y los cambios sin guardar (`drafts`).
  const [base, setBase] = useState(() =>
    Object.fromEntries(rooms.map((room) => [room.id, dataFromApi(room)])),
  );
  const [drafts, setDrafts] = useState({});
  // Eliminar una sala guardada: { room, loading, count, error } mientras se comprueban sus reservas futuras.
  const [deleting, setDeleting] = useState(null);

  const baseOf = (id) => base[id] ?? EMPTY_DATA;
  const dataOf = (id) => drafts[id] ?? baseOf(id);
  const pending = editor.salas
    .map((sala) => ({ sala, body: patchFor(baseOf(sala.id), dataOf(sala.id), sala.tipo) }))
    .filter((item) => item.body);
  const dirty = editor.dirty || pending.length > 0;

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
    if (!dirty) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Primera sala con datos que no se pueden guardar (código o nombre vacíos, o números fuera de rango).
  const firstInvalid = () =>
    editor.salas.find(
      (sala) =>
        Object.keys(roomInfoErrors(sala)).length > 0 ||
        (hasClientData(sala.tipo) &&
          Object.keys(validateData(dataOf(sala.id), baseOf(sala.id))).length > 0),
    );

  // Guarda el mapa (si ha cambiado) y luego los datos para el cliente de las salas que han cambiado. Devuelve true
  // si se ha guardado todo.
  const save = async () => {
    const invalid = firstInvalid();
    if (invalid) {
      editor.setTool('select');
      editor.select(invalid.id);
      setResult({
        type: 'error',
        text: `Revisa los datos de ${invalid.codigo || 'la sala seleccionada'}: hay campos con errores.`,
      });
      return false;
    }
    setSaving(true);
    setResult(null);
    const mapChanged = editor.dirty;
    if (mapChanged) {
      try {
        await saveFloorMap(floor.id, {
          ancho: editor.plan.ancho,
          alto: editor.plan.alto,
          origen: map.origen ?? 'manual',
          salas: editor.salas,
        });
        editor.markSaved();
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
        setSaving(false);
        return false;
      }
    }

    // Las salas guardadas en el mapa ya existen en la API.
    const nextBase = { ...base };
    for (const sala of editor.salas) if (!nextBase[sala.id]) nextBase[sala.id] = EMPTY_DATA;
    const nextDrafts = { ...drafts };
    const failures = [];
    for (const { sala, body } of pending) {
      try {
        await updateRoom(sala.id, body);
        nextBase[sala.id] = hasClientData(sala.tipo)
          ? savedData(dataOf(sala.id))
          : { ...nextBase[sala.id], reservable: false };
        delete nextDrafts[sala.id];
      } catch (error) {
        failures.push(`${sala.codigo}: ${error?.message || 'no se ha podido guardar'}`);
      }
    }
    setBase(nextBase);
    setDrafts(nextDrafts);
    setSaving(false);

    if (failures.length > 0) {
      setResult({
        type: 'error',
        text: mapChanged
          ? 'Se ha guardado el plano, pero no los datos para el cliente de estas salas. Revísalos y vuelve a guardar.'
          : 'No se han guardado los datos para el cliente de estas salas. Revísalos y vuelve a guardar.',
        details: failures,
      });
      return false;
    }
    setResult({ type: 'success', text: 'Borrador guardado.' });
    return true;
  };

  const changeData = (id, data) => setDrafts((current) => ({ ...current, [id]: data }));

  // Eliminar: una sala recién dibujada se quita sin más (se puede deshacer); una ya guardada solo si no tiene
  // reservas futuras.
  const requestDelete = (id) => {
    const room = editor.salas.find((sala) => sala.id === id);
    if (!room) return;
    if (!base[id]) {
      editor.deleteRoom(id);
      return;
    }
    setDeleting({ room, loading: true, count: null, error: false });
    getRoomFutureBookings(id)
      .then((list) =>
        setDeleting((current) =>
          current?.room.id === id ? { ...current, loading: false, count: list.length } : current,
        ),
      )
      .catch(() =>
        setDeleting((current) =>
          current?.room.id === id ? { ...current, loading: false, error: true } : current,
        ),
      );
  };
  const guardedEditor = { ...editor, deleteRoom: requestDelete };

  const goBack = (event) => {
    if (!dirty) return;
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
        {dirty && <span className={styles.unsaved}>Cambios sin guardar</span>}
        <div className={styles.headerActions}>
          <Button
            variant="secondary"
            size="md"
            loading={saving}
            disabled={locked || !dirty || uploadingPhotos}
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
            onDelete={() => editor.selected && requestDelete(editor.selected.id)}
            canUndo={editor.canUndo}
            onUndo={editor.undo}
          />
          <div className={styles.canvasArea}>
            <MapEditor
              editor={guardedEditor}
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
            <RoomPanel
              editor={editor}
              dataOf={dataOf}
              baseOf={baseOf}
              onDataChange={changeData}
              onDelete={requestDelete}
              deletingId={deleting?.loading ? deleting.room.id : null}
              onUploadingChange={setUploadingPhotos}
            />
          </aside>
        </div>
      </div>

      <UnsavedChangesModal
        open={leaving}
        floorName={floor.nombre}
        canSave={!locked && !uploadingPhotos}
        saving={saving}
        onStay={() => setLeaving(false)}
        onLeave={() => {
          editor.markSaved();
          setDrafts({});
          navigate('/company/buildings');
        }}
        onSave={async () => {
          if (await save()) navigate('/company/buildings');
          else setLeaving(false);
        }}
      />

      {deleting && !deleting.loading && (
        <DeleteRoomModal
          state={deleting}
          onClose={() => setDeleting(null)}
          onRetry={() => requestDelete(deleting.room.id)}
          onConfirm={() => {
            editor.deleteRoom(deleting.room.id);
            setDeleting(null);
          }}
        />
      )}
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
