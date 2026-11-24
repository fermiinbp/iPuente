// Salas de la empresa (wireframes 14 y 14b): tabla con filtros Edificio → Planta → Estado, guardados en la URL
// (`?edificio=…&planta=…&estado=oculta`) y enviados a la API (GET /company/rooms).
// - «Ocultar» quita la sala de la web sin borrarla; si tiene reservas futuras, se mantienen y se avisa.
// - «Mostrar» está desactivado, con el motivo, en las salas sin precio: primero hay que ponérselo con «Editar».
// - «Editar» abre RoomPropertiesPanel en un panel lateral, solo con los datos para el cliente (código, nombre y tipo
//   van con el mapa, en el editor). Se guarda con PATCH /company/rooms/:id.
// Fuera de esta issue: las fotos de la sala (EMP012).
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import RoomPropertiesPanel from '@/components/map-editor/RoomPropertiesPanel/RoomPropertiesPanel.jsx';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import DataTable from '@/components/ui/DataTable/DataTable.jsx';
import EmptyState from '@/components/ui/EmptyState/EmptyState.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import FilterBar from '@/components/ui/FilterBar/FilterBar.jsx';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import SidePanel from '@/components/ui/SidePanel/SidePanel.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge.jsx';
import { ROOM_LISTING_STATUS } from '@/config/constants.js';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import {
  getBuildings,
  getRooms,
  setRoomVisibility,
  updateRoom,
} from '@/services/companyService.js';
import { priceLabel } from '@/utils/formatPrice.js';
import { dataFromApi, patchFor, validateData } from '@/utils/roomData.js';
import styles from './CompanyRooms.module.css';

// Estado de la API (español) → estado de StatusBadge.
const LISTING = {
  publicada: ROOM_LISTING_STATUS.PUBLISHED,
  sin_precio: ROOM_LISTING_STATUS.NO_PRICE,
  oculta: ROOM_LISTING_STATUS.HIDDEN,
  zona_comun: ROOM_LISTING_STATUS.COMMON,
};

const STATUS_OPTIONS = [
  { value: '', label: 'Estado: todas' },
  { value: 'publicada', label: 'Publicadas' },
  { value: 'sin_precio', label: 'Sin precio' },
  { value: 'oculta', label: 'Ocultas' },
  { value: 'zona_comun', label: 'Zonas comunes' },
];

const roomName = (room) => [room.codigo, room.nombre].filter(Boolean).join(' · ') || 'Sala';

// Panel lateral de «Editar»: datos para el cliente de una sala, con su propio borrador.
function EditRoom({ room, onClose, onSaved }) {
  const base = dataFromApi(room);
  const [data, setData] = useState(base);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const errors = validateData(data, base);
  const body = patchFor(base, data, 'sala');

  const save = async () => {
    if (Object.keys(errors).length > 0) {
      setError('Revisa los campos marcados.');
      return;
    }
    if (!body) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateRoom(room.id, body);
      onSaved(`Datos de ${roomName(room)} guardados.`);
    } catch (err) {
      setError(err?.message || 'No hemos podido guardar los datos. Inténtalo de nuevo.');
      setSaving(false);
    }
  };

  return (
    <SidePanel
      open
      onClose={onClose}
      title={`Editar ${roomName(room)}`}
      titleExtra={<StatusBadge kind="roomListing" status={LISTING[room.estado]} />}
      footer={
        <div className={styles.footer}>
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="md" loading={saving} disabled={!body || uploading} onClick={save}>
            Guardar
          </Button>
        </div>
      }
    >
      <div className={styles.panelBody}>
        {error && <Alert type="error">{error}</Alert>}
        <RoomPropertiesPanel
          room={room}
          title={null}
          editableInfo={false}
          data={data}
          base={base}
          onDataChange={setData}
          onUploadingChange={setUploading}
        />
      </div>
    </SidePanel>
  );
}

function Content({ buildings }) {
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(null);
  const [changing, setChanging] = useState(null);
  const [notice, setNotice] = useState(null);

  // Filtros de la URL; un edificio o una planta que no son de la empresa se ignoran.
  const building = buildings.find((b) => b.id === params.get('edificio'));
  const edificio = building?.id ?? '';
  const floors = building?.plantas ?? [];
  const planta = floors.some((f) => f.id === params.get('planta')) ? params.get('planta') : '';
  const estado = STATUS_OPTIONS.some((o) => o.value && o.value === params.get('estado'))
    ? params.get('estado')
    : '';

  const list = useFetch(
    (signal) => getRooms({ buildingId: edificio, floorId: planta, estado }, { signal }),
    `${edificio}|${planta}|${estado}`,
  );
  const rooms = Array.isArray(list.data) ? list.data : [];

  const floorName = new Map(buildings.flatMap((b) => (b.plantas ?? []).map((p) => [p.id, p])));
  const buildingName = new Map(buildings.map((b) => [b.id, b.nombre]));

  const filters = [
    {
      name: 'edificio',
      label: 'Edificio',
      options: [
        { value: '', label: 'Todos los edificios' },
        ...buildings.map((b) => ({ value: b.id, label: b.nombre })),
      ],
    },
    {
      name: 'planta',
      label: 'Planta',
      options: [
        { value: '', label: edificio ? 'Todas las plantas' : 'Elige un edificio' },
        ...floors.map((f) => ({ value: f.id, label: f.nombre })),
      ],
    },
    { name: 'estado', label: 'Estado', options: STATUS_OPTIONS },
  ];

  const changeFilter = (name, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    // Al cambiar de edificio, la planta elegida puede no ser suya.
    if (name === 'edificio') next.delete('planta');
    setParams(next, { replace: true });
    setNotice(null);
  };

  const toggleVisibility = async (room) => {
    const visible = room.estado !== 'publicada';
    setChanging(room.id);
    setNotice(null);
    try {
      const result = await setRoomVisibility(room.id, visible);
      const text = visible
        ? `${roomName(room)} se muestra en la web.`
        : `${roomName(room)} está oculta: ya no se puede reservar.`;
      setNotice({
        type: result?.aviso ? 'warning' : 'success',
        text: result?.aviso ? `${text} ${result.aviso}.` : text,
      });
      list.reload();
    } catch (error) {
      setNotice({
        type: 'error',
        text:
          error?.code === 'ROOM_WITHOUT_PRICE'
            ? `${roomName(room)} no tiene precio: ponle uno con «Editar» antes de mostrarla.`
            : error?.message || 'No hemos podido cambiar la sala. Inténtalo de nuevo.',
      });
    } finally {
      setChanging(null);
    }
  };

  const columns = [
    {
      key: 'sala',
      label: 'Sala',
      render: (room) => <span className={styles.name}>{roomName(room)}</span>,
    },
    {
      key: 'planta',
      label: 'Planta',
      render: (room) => (
        <span className={styles.stack}>
          <span>{floorName.get(room.floorId)?.nombre ?? '—'}</span>
          {!edificio && (
            <span className={styles.muted}>{buildingName.get(room.buildingId) ?? ''}</span>
          )}
        </span>
      ),
    },
    {
      key: 'precio',
      label: 'Precio/h',
      render: (room) => priceLabel(room.precioHora, { gratis: room.gratis }),
    },
    { key: 'capacidad', label: 'Capacidad', render: (room) => room.capacidad || '—' },
    {
      key: 'estado',
      label: 'Estado',
      render: (room) => <StatusBadge kind="roomListing" status={LISTING[room.estado]} />,
    },
  ];

  const actions = (room) => {
    // Aseos, pasillos, cocina…: no se alquilan, así que no hay datos para el cliente ni visibilidad.
    if (room.estado === 'zona_comun') {
      return <span className={styles.muted}>No se alquila</span>;
    }
    const noPrice = room.estado === 'sin_precio';
    const hintId = `sin-precio-${room.id}`;
    return (
      <div className={styles.actions}>
        <Button
          variant="secondary"
          size="md"
          onClick={() => setEditing(room)}
          aria-label={`Editar ${roomName(room)}`}
        >
          Editar
        </Button>
        <Button
          variant="secondary"
          size="md"
          loading={changing === room.id}
          disabled={noPrice}
          aria-describedby={noPrice ? hintId : undefined}
          onClick={() => toggleVisibility(room)}
          aria-label={`${room.estado === 'publicada' ? 'Ocultar' : 'Mostrar'} ${roomName(room)}`}
        >
          {room.estado === 'publicada' ? 'Ocultar' : 'Mostrar'}
        </Button>
        {noPrice && (
          <span id={hintId} className={styles.muted}>
            Ponle precio para mostrarla
          </span>
        )}
      </div>
    );
  };

  let body;
  if (list.loading) body = <Spinner label="Cargando salas…" />;
  else if (list.error) {
    body = (
      <ErrorState
        error={list.error}
        title="No hemos podido cargar las salas"
        onRetry={list.reload}
      />
    );
  } else {
    const filtered = Boolean(edificio || planta || estado);
    body = (
      <DataTable
        minWidth={860}
        caption="Salas"
        columns={columns}
        rows={rooms}
        getRowKey={(room) => room.id}
        actions={actions}
        emptyTitle={filtered ? 'No hay salas con estos filtros' : 'Todavía no tienes salas'}
        emptyText={
          filtered
            ? 'Prueba con otro edificio, otra planta u otro estado.'
            : 'Dibuja las salas de una planta en el editor de mapas y aparecerán aquí.'
        }
        emptyAction={
          filtered ? undefined : <Button to="/company/buildings">Ir a Mis edificios</Button>
        }
      />
    );
  }

  return (
    <>
      <FilterBar filters={filters} values={{ edificio, planta, estado }} onChange={changeFilter} />
      {notice && (
        <div className={styles.notice}>
          <Alert type={notice.type} className={styles.noticeAlert}>
            {notice.text}
          </Alert>
          <Button variant="ghost" size="md" onClick={() => setNotice(null)}>
            Cerrar aviso
          </Button>
        </div>
      )}
      <div className={editing ? styles.withPanel : undefined}>
        <div className={styles.list}>{body}</div>
        {editing && (
          <EditRoom
            key={editing.id}
            room={editing}
            onClose={() => setEditing(null)}
            onSaved={(text) => {
              setEditing(null);
              setNotice({ type: 'success', text });
              list.reload();
            }}
          />
        )}
      </div>
    </>
  );
}

export default function CompanyRooms() {
  usePageTitle('Salas');
  const buildings = useFetch((signal) => getBuildings({ signal }), 'company-rooms-buildings');

  let content;
  if (buildings.loading) content = <Spinner label="Cargando salas…" />;
  else if (buildings.error) {
    content = (
      <ErrorState
        error={buildings.error}
        title="No hemos podido cargar tus edificios"
        onRetry={buildings.reload}
      />
    );
  } else if (!buildings.data?.length) {
    content = (
      <EmptyState
        title="Todavía no tienes salas"
        text="Crea un edificio y dibuja las salas de sus plantas en el editor de mapas."
        action={<Button to="/company/buildings">Ir a Mis edificios</Button>}
      />
    );
  } else content = <Content buildings={buildings.data} />;

  return (
    <PageContainer>
      <h1 className={styles.title}>Salas</h1>
      <div className={styles.content}>{content}</div>
    </PageContainer>
  );
}
