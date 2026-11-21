// Reservas de las salas de la empresa y bloqueo de horas (wireframes 15 y 15d).
// Filtros Edificio → Sala → Fecha, guardados en la URL (`?edificio=…&sala=…&fecha=proximos7`). La API da las reservas
// y los bloqueos por separado: se piden a la vez con el rango y la sala, y se unen en una sola tabla, donde los
// bloqueos salen con el estado «Bloqueada» y su motivo. El filtro por edificio se aplica aquí (la API no lo tiene).
// «Bloquear horas» abre BlockHoursModal; un bloqueo se quita desde su fila, con confirmación.
// Fuera de esta issue: el detalle de una reserva en panel lateral y cancelarla (EMP014).
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import BlockHoursModal from '@/components/company/BlockHoursModal/BlockHoursModal.jsx';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import ConfirmModal from '@/components/ui/ConfirmModal/ConfirmModal.jsx';
import DataTable from '@/components/ui/DataTable/DataTable.jsx';
import EmptyState from '@/components/ui/EmptyState/EmptyState.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import FilterBar from '@/components/ui/FilterBar/FilterBar.jsx';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge.jsx';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import {
  deleteBlock,
  getBlocks,
  getBookings,
  getBuildings,
  getRooms,
} from '@/services/companyService.js';
import {
  DATE_RANGES,
  DEFAULT_RANGE,
  formatSlot,
  mergeRows,
  rangeFor,
} from '@/utils/companyBookings.js';
import { priceLabel } from '@/utils/formatPrice.js';
import styles from './CompanyBookings.module.css';

// Tope de resultados de cada listado en la API.
const API_LIMIT = 500;

const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

function formatDate(fecha) {
  const [year, month, day] = fecha.split('-').map(Number);
  return DATE_FORMAT.format(new Date(year, month - 1, day)).replace(/\./g, '');
}

const roomName = (sala) => (sala ? [sala.codigo, sala.nombre].filter(Boolean).join(' · ') : '—');

const COLUMNS = [
  { key: 'fecha', label: 'Fecha', render: (row) => formatDate(row.fecha) },
  { key: 'horario', label: 'Horario', render: (row) => formatSlot(row) },
  { key: 'sala', label: 'Sala', render: (row) => roomName(row.sala) },
  {
    key: 'cliente',
    label: 'Cliente',
    render: (row) =>
      row.tipo === 'bloqueo' ? (
        <span className={styles.stack}>
          <span className={styles.muted}>Bloqueo</span>
          <span className={styles.wrap}>{row.motivo}</span>
        </span>
      ) : (
        <span className={styles.stack}>
          <span className={styles.wrap}>{row.cliente?.nombre || 'Cliente'}</span>
          {row.cliente?.email && (
            <span className={`${styles.muted} ${styles.wrap}`}>{row.cliente.email}</span>
          )}
        </span>
      ),
  },
  {
    key: 'estado',
    label: 'Estado',
    render: (row) => <StatusBadge kind="booking" status={row.estado} />,
  },
  {
    key: 'importe',
    label: 'Importe',
    render: (row) => (row.tipo === 'bloqueo' ? '—' : priceLabel(row.importe)),
  },
];

// Edificios y salas de la empresa: opciones de los filtros y del modal.
async function loadCatalog(signal) {
  const [buildings, rooms] = await Promise.all([getBuildings({ signal }), getRooms({ signal })]);
  const buildingName = new Map(buildings.map((b) => [b.id, b.nombre]));
  const floorName = new Map(
    buildings.flatMap((b) => (b.plantas ?? []).map((p) => [p.id, p.nombre])),
  );
  return {
    buildings: buildings.map((b) => ({ id: b.id, nombre: b.nombre })),
    rooms: rooms.map((r) => ({
      id: r.id,
      buildingId: r.buildingId,
      group: buildingName.get(r.buildingId) ?? 'Otro edificio',
      label: [
        [r.codigo, r.nombre].filter(Boolean).join(' · '),
        floorName.get(r.floorId) && `(${floorName.get(r.floorId)})`,
      ]
        .filter(Boolean)
        .join(' '),
    })),
  };
}

function Content({ catalog }) {
  const [params, setParams] = useSearchParams();
  const [blocking, setBlocking] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [removeState, setRemoveState] = useState({ loading: false, error: null });
  const [notice, setNotice] = useState(null);

  // Filtros de la URL; un edificio o una sala que no son de la empresa se ignoran.
  const edificio = catalog.buildings.some((b) => b.id === params.get('edificio'))
    ? params.get('edificio')
    : '';
  const roomsInBuilding = edificio
    ? catalog.rooms.filter((r) => r.buildingId === edificio)
    : catalog.rooms;
  const sala = roomsInBuilding.some((r) => r.id === params.get('sala')) ? params.get('sala') : '';
  const fecha = DATE_RANGES.some((d) => d.value === params.get('fecha'))
    ? params.get('fecha')
    : DEFAULT_RANGE;
  const { desde, hasta } = rangeFor(fecha);

  const list = useFetch(
    (signal) =>
      Promise.all([
        getBookings({ desde, hasta, roomId: sala }, { signal }),
        getBlocks({ desde, hasta, roomId: sala }, { signal }),
      ]).then(([bookings, blocks]) => ({ bookings, blocks })),
    `${desde}|${hasta}|${sala}`,
  );

  const buildingOf = useMemo(
    () => new Map(catalog.rooms.map((r) => [r.id, r.buildingId])),
    [catalog.rooms],
  );
  const rows = useMemo(() => {
    if (!list.data) return [];
    const all = mergeRows(list.data.bookings, list.data.blocks);
    return edificio ? all.filter((row) => buildingOf.get(row.roomId) === edificio) : all;
  }, [list.data, edificio, buildingOf]);
  const truncated =
    list.data && (list.data.bookings.length >= API_LIMIT || list.data.blocks.length >= API_LIMIT);

  const filters = [
    {
      name: 'edificio',
      label: 'Edificio',
      options: [
        { value: '', label: 'Todos los edificios' },
        ...catalog.buildings.map((b) => ({ value: b.id, label: b.nombre })),
      ],
    },
    {
      name: 'sala',
      label: 'Sala',
      options: [
        { value: '', label: 'Todas las salas' },
        ...roomsInBuilding.map((r) => ({ value: r.id, label: r.label })),
      ],
    },
    { name: 'fecha', label: 'Fecha', options: DATE_RANGES },
  ];

  const changeFilter = (name, value) => {
    const next = new URLSearchParams(params);
    if (value && !(name === 'fecha' && value === DEFAULT_RANGE)) next.set(name, value);
    else next.delete(name);
    // Al cambiar de edificio, la sala elegida puede no ser suya.
    if (name === 'edificio') next.delete('sala');
    setParams(next, { replace: true });
    setNotice(null);
  };

  const confirmRemove = async () => {
    setRemoveState({ loading: true, error: null });
    try {
      await deleteBlock(removing.id);
      setNotice(
        `Bloqueo quitado: ${roomName(removing.sala)}, ${formatDate(removing.fecha)}, ${formatSlot(removing)}.`,
      );
      setRemoving(null);
      setRemoveState({ loading: false, error: null });
      list.reload();
    } catch (error) {
      setRemoveState({
        loading: false,
        error: error?.message || 'No hemos podido quitar el bloqueo. Inténtalo de nuevo.',
      });
    }
  };

  const hasRooms = catalog.rooms.length > 0;

  let body;
  if (!hasRooms) {
    body = (
      <EmptyState
        title="Todavía no tienes salas"
        text="Cuando dibujes las salas de una planta, aquí verás sus reservas y podrás bloquear horas."
        action={<Button to="/company/buildings">Ir a Mis edificios</Button>}
      />
    );
  } else if (list.loading) {
    body = <Spinner label="Cargando reservas…" />;
  } else if (list.error) {
    body = (
      <ErrorState
        error={list.error}
        title="No hemos podido cargar las reservas"
        onRetry={list.reload}
      />
    );
  } else {
    body = (
      <>
        {truncated && (
          <Alert type="warning">
            Hay muchas reservas en estas fechas y solo se muestran {API_LIMIT}. Elige un rango más
            corto o una sala.
          </Alert>
        )}
        <DataTable
          caption="Reservas y bloqueos"
          columns={COLUMNS}
          rows={rows}
          getRowKey={(row) => row.key}
          actions={(row) =>
            row.tipo === 'bloqueo' ? (
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setRemoveState({ loading: false, error: null });
                  setRemoving(row);
                }}
              >
                Quitar bloqueo
              </Button>
            ) : null
          }
          emptyTitle="No hay reservas en estas fechas"
          emptyText="Prueba con otro rango de fechas, otro edificio u otra sala."
        />
      </>
    );
  }

  return (
    <>
      <FilterBar
        filters={filters}
        values={{ edificio, sala, fecha }}
        onChange={changeFilter}
        actions={
          <Button size="md" disabled={!hasRooms} onClick={() => setBlocking(true)}>
            Bloquear horas
          </Button>
        }
      />
      {notice && (
        <div className={styles.notice}>
          <Alert type="success" className={styles.noticeAlert}>
            {notice}
          </Alert>
          <Button variant="ghost" size="md" onClick={() => setNotice(null)}>
            Cerrar aviso
          </Button>
        </div>
      )}
      {body}

      {blocking && (
        <BlockHoursModal
          rooms={catalog.rooms}
          defaultRoomId={sala}
          onClose={() => setBlocking(false)}
          onCreated={(bloqueo) => {
            setBlocking(false);
            setNotice(
              `Horas bloqueadas: ${roomName(bloqueo.sala)}, ${formatDate(bloqueo.fecha)}, ${formatSlot(bloqueo)}.`,
            );
            list.reload();
          }}
        />
      )}

      <ConfirmModal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="¿Quitar este bloqueo?"
        text={
          removing
            ? `${roomName(removing.sala)}, ${formatDate(removing.fecha)}, ${formatSlot(removing)}. Los clientes podrán volver a reservar esas horas.`
            : ''
        }
        confirmLabel="Quitar bloqueo"
        onConfirm={confirmRemove}
        loading={removeState.loading}
      >
        {removeState.error && <Alert type="error">{removeState.error}</Alert>}
      </ConfirmModal>
    </>
  );
}

export default function CompanyBookings() {
  usePageTitle('Reservas');
  const catalog = useFetch((signal) => loadCatalog(signal), 'company-bookings-catalog');

  let content;
  if (catalog.loading) content = <Spinner label="Cargando reservas…" />;
  else if (catalog.error) {
    content = (
      <ErrorState
        error={catalog.error}
        title="No hemos podido cargar tus salas"
        onRetry={catalog.reload}
      />
    );
  } else content = <Content catalog={catalog.data} />;

  return (
    <PageContainer>
      <h1 className={styles.title}>Reservas</h1>
      <div className={styles.content}>{content}</div>
    </PageContainer>
  );
}
