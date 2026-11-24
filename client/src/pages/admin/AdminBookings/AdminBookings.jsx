// Reservas del panel de admin (/admin/bookings, wireframes 19 y 19b adaptados a la API): filtros de empresa, estado y
// fecha y página en la URL (`?empresa=&estado=&fecha=&page=`), tabla de todas las reservas y detalle en un SidePanel
// con BookingDetail en modo admin. El detalle va en la URL (`/admin/bookings/:bookingId`, se lee con la API: el enlace
// directo funciona) y al cerrarlo se vuelve a la lista con los mismos filtros. Sin desglose, historial ni
// «Reembolsar»: la API no los tiene en la reserva (el reembolso va por pago, en Pagos).
import { useNavigate, useParams, useSearchParams } from 'react-router';
import BookingDetail from '@/components/booking/BookingDetail/BookingDetail.jsx';
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
import { BOOKING_STATUS, ROLES } from '@/config/constants.js';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { getBooking, listBookings, listCompanies } from '@/services/adminService.js';
import { detailStatus, detailTitle } from '@/utils/bookingDetail.js';
import { DATE_RANGES, formatSlot, rangeFor } from '@/utils/companyBookings.js';
import { formatCompanyDate } from '@/utils/companyActions.js';
import { priceLabel } from '@/utils/formatPrice.js';
import styles from './AdminBookings.module.css';

// La API no deja pasar de la página 25.
const MAX_PAGE = 25;
const PAGE_SIZE = 20;
// Mismo formato de id que acepta la API (`companyId`); otro valor en la URL se ignora.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: BOOKING_STATUS.PENDING_PAYMENT, label: 'Pendientes de pago' },
  { value: BOOKING_STATUS.CONFIRMED, label: 'Confirmadas' },
  { value: BOOKING_STATUS.CANCELLED, label: 'Canceladas' },
  { value: BOOKING_STATUS.EXPIRED, label: 'Caducadas' },
  { value: BOOKING_STATUS.COMPLETED, label: 'Completadas' },
];
const ESTADOS = ESTADO_OPTIONS.map((o) => o.value).filter(Boolean);

// Fecha: por defecto (vacío) el rango de la API, de hace 30 días a dentro de 90; el resto, los del panel de empresa.
const FECHA_OPTIONS = [{ value: '', label: 'Recientes y próximas' }, ...DATE_RANGES];
const FECHAS = DATE_RANGES.map((o) => o.value);

const roomLine = (row) =>
  [row.sala?.nombre, row.edificio?.nombre].filter(Boolean).join(' · ') || '—';

const COLUMNS = [
  { key: 'fecha', label: 'Fecha', render: (row) => formatCompanyDate(row.fecha) },
  { key: 'horario', label: 'Horario', render: (row) => formatSlot(row) },
  {
    key: 'sala',
    label: 'Sala',
    render: (row) => <span className={styles.wrap}>{roomLine(row)}</span>,
  },
  {
    key: 'empresa',
    label: 'Empresa',
    render: (row) => <span className={styles.wrap}>{row.empresa?.nombre || '—'}</span>,
  },
  {
    key: 'cliente',
    label: 'Cliente',
    render: (row) => (
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
  { key: 'importe', label: 'Importe', render: (row) => priceLabel(row.importe) },
];

// Panel lateral con el detalle de una reserva (lo pide a la API).
function DetailPanel({ bookingId, onClose }) {
  const detail = useFetch((signal) => getBooking(bookingId, { signal }), `booking-${bookingId}`);
  const item = detail.data;

  let content;
  if (detail.loading) content = <Spinner label="Cargando la reserva…" />;
  else if (detail.error) {
    content =
      detail.error.status === 404 ? (
        <EmptyState
          title="No encontramos esta reserva"
          text="Puede que se haya eliminado o que el enlace no sea correcto."
        />
      ) : (
        <ErrorState
          error={detail.error}
          title="No hemos podido cargar la reserva"
          onRetry={detail.reload}
        />
      );
  } else {
    content = <BookingDetail booking={item} role={ROLES.ADMIN} showHeader={false} />;
  }

  return (
    <SidePanel
      open
      onClose={onClose}
      title={item ? detailTitle(item) : 'Reserva'}
      titleExtra={
        item ? <StatusBadge kind="booking" status={detailStatus(item, ROLES.ADMIN)} /> : null
      }
    >
      {content}
    </SidePanel>
  );
}

export default function AdminBookings() {
  usePageTitle('Reservas');
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const empresaParam = searchParams.get('empresa') ?? '';
  const empresa = ID_PATTERN.test(empresaParam) ? empresaParam : '';
  const estadoParam = searchParams.get('estado') ?? '';
  const estado = ESTADOS.includes(estadoParam) ? estadoParam : '';
  const fechaParam = searchParams.get('fecha') ?? '';
  const fecha = FECHAS.includes(fechaParam) ? fechaParam : '';
  const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? Math.min(pageParam, MAX_PAGE) : 1;
  const { desde, hasta } = fecha ? rangeFor(fecha) : {};

  const companies = useFetch((signal) => listCompanies('', { signal }), 'admin-companies-all');
  const list = useFetch(
    (signal) => listBookings({ estado, desde, hasta, companyId: empresa, page }, { signal }),
    `bookings-${empresa}|${estado}|${fecha}|${page}`,
  );

  // Desplegable de empresas: si la lista falla, el filtro queda solo con «Todas». Si la empresa de la URL aún no está
  // en la lista (cargando, error o id desconocido), se añade una opción provisional para que el desplegable no quede
  // en blanco.
  const companyOptions = [
    { value: '', label: 'Todas' },
    ...(companies.data?.empresas ?? [])
      .map((c) => ({ value: c.id, label: c.nombre || 'Sin nombre' }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es')),
  ];
  if (empresa && !companyOptions.some((o) => o.value === empresa)) {
    companyOptions.push({
      value: empresa,
      label: companies.loading ? 'Cargando empresa…' : 'Empresa no encontrada',
    });
  }
  const filters = [
    { name: 'empresa', label: 'Empresa', options: companyOptions },
    { name: 'estado', label: 'Estado', options: ESTADO_OPTIONS },
    { name: 'fecha', label: 'Fecha', options: FECHA_OPTIONS },
  ];

  // Cambiar un filtro o la página crea una entrada en el historial (atrás la deshace).
  const update = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([name, value]) => {
      if (value) next.set(name, String(value));
      else next.delete(name);
    });
    setSearchParams(next);
  };
  const changeFilter = (name, value) => update({ [name]: value, page: '' });
  const goToPage = (target) => update({ page: target > 1 ? target : '' });

  const search = searchParams.toString();
  const openDetail = (row) =>
    navigate({
      pathname: `/admin/bookings/${encodeURIComponent(row.id)}`,
      search: search ? `?${search}` : '',
    });
  const closeDetail = () =>
    navigate({ pathname: '/admin/bookings', search: search ? `?${search}` : '' });

  const filtered = Boolean(empresa || estado || fecha);

  const renderList = () => {
    if (list.loading) return <Spinner label="Cargando reservas…" />;
    if (list.error) {
      return (
        <ErrorState
          error={list.error}
          title="No hemos podido cargar las reservas"
          onRetry={list.reload}
        />
      );
    }
    const data = list.data;
    const total = data?.total ?? 0;
    const lastPage = Math.min(Math.max(Math.ceil(total / (data?.limit || PAGE_SIZE)), 1), MAX_PAGE);
    const pastEnd = total > 0 && page > lastPage;
    return (
      <>
        {data?.truncado && (
          <Alert type="warning">
            Hay muchas reservas en estas fechas: el listado solo está completo desde el{' '}
            {formatCompanyDate(data.desdeEfectivo)}. Elige un rango más corto, una empresa o un
            estado para ver las anteriores.
          </Alert>
        )}
        <DataTable
          minWidth={1040}
          caption="Reservas de todas las empresas"
          columns={COLUMNS}
          rows={data?.reservas ?? []}
          actions={(row) => (
            <Button
              variant="ghost"
              size="md"
              onClick={() => openDetail(row)}
              aria-label={`Ver ${detailTitle(row).toLowerCase()} de ${row.cliente?.nombre || 'cliente'}, ${formatCompanyDate(row.fecha)}`}
            >
              Ver
            </Button>
          )}
          emptyTitle={
            pastEnd
              ? 'Esta página no tiene reservas'
              : filtered
                ? 'Ninguna reserva coincide'
                : 'No hay reservas en estas fechas'
          }
          emptyText={
            pastEnd
              ? `La última página es la ${lastPage}.`
              : 'Prueba con otra empresa, otro estado u otro rango de fechas.'
          }
        />
        {total > 0 && (
          <nav className={styles.pager} aria-label="Paginación de reservas">
            <p className={styles.pagerInfo}>
              Página {Math.min(page, lastPage)} de {lastPage} · {total}{' '}
              {total === 1 ? 'reserva' : 'reservas'}
            </p>
            <div className={styles.pagerButtons}>
              <Button
                variant="secondary"
                size="md"
                disabled={page <= 1}
                onClick={() => goToPage(Math.min(page - 1, lastPage))}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="md"
                disabled={page >= lastPage}
                onClick={() => goToPage(page + 1)}
              >
                Siguiente
              </Button>
            </div>
          </nav>
        )}
      </>
    );
  };

  return (
    <PageContainer>
      <h1 className={styles.title}>Reservas</h1>
      <div className={styles.content}>
        <FilterBar filters={filters} values={{ empresa, estado, fecha }} onChange={changeFilter} />
        <div className={bookingId ? styles.withPanel : undefined}>
          <div className={styles.list}>{renderList()}</div>
          {bookingId && <DetailPanel key={bookingId} bookingId={bookingId} onClose={closeDetail} />}
        </div>
      </div>
    </PageContainer>
  );
}
