// Resumen del panel de empresa (wireframes 11 y 11b), con GET /company/summary.
// Con edificios: 4 cifras, próximas reservas (DataTable) y tareas pendientes con «Resolver →».
// Primer acceso (`primerAcceso`, sin edificios): bienvenida con los 3 pasos, sin cifras y sin reservas; el nombre de
// la empresa se pide solo en este caso (GET /companies/me). El paso de Stripe lee `getPayouts` y lleva a Cobros.
import { Link } from 'react-router';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import Chip from '@/components/ui/Chip/Chip.jsx';
import DataTable from '@/components/ui/DataTable/DataTable.jsx';
import EmptyState from '@/components/ui/EmptyState/EmptyState.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import StatCard from '@/components/ui/StatCard/StatCard.jsx';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge.jsx';
import { PAYOUT_ACCOUNT_STATUS } from '@/config/constants.js';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { getMyCompany, getPayouts, getSummary } from '@/services/companyService.js';
import { formatPrice } from '@/utils/formatPrice.js';
import styles from './CompanyDashboard.module.css';

// Estado de la cuenta de cobros de la API → etiqueta del panel.
const PAYOUT_STATUS_BY_ESTADO = {
  none: PAYOUT_ACCOUNT_STATUS.NOT_CONNECTED,
  pending: PAYOUT_ACCOUNT_STATUS.PENDING_VERIFICATION,
  restricted: PAYOUT_ACCOUNT_STATUS.RESTRICTED,
  active: PAYOUT_ACCOUNT_STATUS.ACTIVE,
};

// Plantas sin publicar que se listan una a una; el resto se resume en «y N más».
const MAX_FLOOR_TASKS = 5;

const DAY_FORMAT = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const pad = (hour) => String(hour).padStart(2, '0');

// «jue, 20 nov · 12:00–14:00» a partir de fecha AAAA-MM-DD y horas enteras.
function formatSlot({ fecha, inicio, fin }) {
  const [year, month, day] = fecha.split('-').map(Number);
  const dayText = DAY_FORMAT.format(new Date(year, month - 1, day)).replace(/\./g, '');
  return `${dayText} · ${pad(inicio)}:00–${pad(fin)}:00`;
}

const BOOKING_COLUMNS = [
  {
    key: 'sala',
    label: 'Sala',
    render: (row) => row.sala?.nombre ?? row.sala?.codigo ?? '—',
  },
  { key: 'fecha', label: 'Fecha', render: formatSlot },
  { key: 'cliente', label: 'Cliente', render: (row) => row.cliente?.nombre || '—' },
  {
    key: 'estado',
    label: 'Estado',
    render: (row) => <StatusBadge kind="booking" status={row.estado} />,
  },
];

// Tareas pendientes → [{ id, text, to }]. Las plantas van una a una (editor de esa planta); las salas, juntas.
function buildTasks(tareas) {
  const { plantasSinPublicar = [], salasSinPrecio = [], salasSinFotos = [], totales = {} } = tareas;
  const tasks = plantasSinPublicar.slice(0, MAX_FLOOR_TASKS).map((planta) => ({
    id: `planta-${planta.id}`,
    text: `${planta.nombre}${planta.edificio ? ` (${planta.edificio})` : ''} ${
      planta.sinMapa ? 'sin salas dibujadas' : 'sin publicar'
    }`,
    to: `/company/floors/${planta.id}/editor`,
  }));

  const extraFloors = (totales.plantasSinPublicar ?? plantasSinPublicar.length) - tasks.length;
  if (extraFloors > 0) {
    tasks.push({
      id: 'plantas-resto',
      text: `y ${extraFloors} ${extraFloors === 1 ? 'planta' : 'plantas'} más sin publicar`,
      to: '/company/buildings',
    });
  }

  // TODO(EMP011): llevar a la sala concreta cuando CompanyRooms sepa abrirla por su id.
  const roomTask = (list, total, singular, plural, id) => {
    const count = total ?? list.length;
    if (count === 0) return;
    tasks.push({
      id,
      text: count === 1 && list[0] ? `${list[0].nombre} ${singular}` : `${count} salas ${plural}`,
      to: '/company/rooms',
    });
  };
  roomTask(salasSinPrecio, totales.salasSinPrecio, 'sin precio', 'sin precio', 'sin-precio');
  roomTask(salasSinFotos, totales.salasSinFotos, 'sin fotos', 'sin fotos', 'sin-fotos');

  return tasks;
}

function SummaryError({ error, onRetry }) {
  if (error?.code === 'COMPANY_NOT_APPROVED') {
    return (
      <ErrorState
        title="Tu empresa todavía no está aprobada"
        actions={
          <Button to="/company/request" variant="secondary">
            Ver el estado de tu solicitud
          </Button>
        }
      >
        {error.message}
      </ErrorState>
    );
  }
  return <ErrorState error={error} title="No hemos podido cargar el resumen" onRetry={onRetry} />;
}

function Welcome() {
  const { data: company } = useFetch((signal) => getMyCompany({ signal }), 'company-me');
  // Si no se puede leer el estado de cobros, el paso se queda como «Sin conectar» y se decide en Cobros.
  const { data: payouts } = useFetch(
    (signal) => getPayouts({ signal }).catch(() => null),
    'company-payouts-welcome',
  );
  const payoutStatus =
    PAYOUT_STATUS_BY_ESTADO[payouts?.estado] ?? PAYOUT_ACCOUNT_STATUS.NOT_CONNECTED;

  return (
    <section className={styles.welcome} aria-labelledby="bienvenida">
      <h2 id="bienvenida" className={styles.welcomeTitle}>
        {company?.nombreEmpresa
          ? `Te damos la bienvenida, ${company.nombreEmpresa}`
          : 'Te damos la bienvenida'}
      </h2>
      <p className={styles.welcomeText}>Tres pasos para publicar tus primeras salas.</p>
      <ol className={styles.steps}>
        <li className={styles.step}>
          <span className={styles.stepNumber} aria-hidden="true">
            1
          </span>
          <div className={styles.stepBody}>
            <div className={styles.stepHeading}>
              <h3 className={styles.stepTitle}>Conecta tu cuenta de cobro</h3>
              <StatusBadge kind="payoutAccount" status={payoutStatus} />
              <Chip>Modo prueba</Chip>
            </div>
            <p className={styles.stepText}>Con Stripe, para recibir el dinero de tus reservas.</p>
          </div>
          <Button variant="secondary" to="/company/settings?tab=cobros">
            {payoutStatus === PAYOUT_ACCOUNT_STATUS.ACTIVE ? 'Ver cobros' : 'Ir a Cobros'}
          </Button>
        </li>
        <li className={styles.step}>
          <span className={styles.stepNumber} aria-hidden="true">
            2
          </span>
          <div className={styles.stepBody}>
            <div className={styles.stepHeading}>
              <h3 className={styles.stepTitle}>Crea tu primer edificio</h3>
              <Chip>Pendiente</Chip>
            </div>
            <p className={styles.stepText}>Datos, foto de la fachada y plantas.</p>
          </div>
          <Button to="/company/buildings/new" variant="secondary">
            Nuevo edificio
          </Button>
        </li>
        <li className={styles.step}>
          <span className={styles.stepNumber} aria-hidden="true">
            3
          </span>
          <div className={styles.stepBody}>
            <div className={styles.stepHeading}>
              <h3 className={styles.stepTitle}>Sube el plano de una planta y publícala</h3>
              <Chip>Después del paso anterior</Chip>
            </div>
            <p className={styles.stepText}>Dibuja las salas y revisa sus precios y fotos.</p>
          </div>
          <Button variant="secondary" disabled>
            Ir al editor
          </Button>
        </li>
      </ol>
    </section>
  );
}

function UpcomingBookings({ rows, firstAccess }) {
  return (
    <section className={styles.panel} aria-labelledby="proximas-reservas">
      <h2 id="proximas-reservas" className={styles.sectionTitle}>
        Próximas reservas
      </h2>
      <DataTable
        caption="Próximas reservas de tus salas"
        columns={BOOKING_COLUMNS}
        rows={rows}
        emptyTitle={firstAccess ? 'Aún no tienes reservas' : 'No tienes reservas próximas'}
        emptyText={firstAccess ? 'Aparecerán aquí cuando publiques tus salas.' : undefined}
      />
    </section>
  );
}

function PendingTasks({ tasks }) {
  return (
    <section className={styles.panel} aria-labelledby="tareas-pendientes">
      <h2 id="tareas-pendientes" className={styles.sectionTitle}>
        Tareas pendientes
      </h2>
      {tasks.length === 0 ? (
        <EmptyState title="No tienes tareas pendientes" />
      ) : (
        <ul className={styles.tasks}>
          {tasks.map((task) => (
            <li key={task.id} className={styles.task}>
              <span className={styles.taskText}>{task.text}</span>
              <Link className={styles.resolve} to={task.to}>
                Resolver <span aria-hidden="true">→</span>
                <span className={styles.srOnly}>: {task.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function CompanyDashboard() {
  usePageTitle('Resumen');
  const { data, error, loading, reload } = useFetch(
    (signal) => getSummary({ signal }),
    'company-summary',
  );

  const renderContent = () => {
    if (loading) return <Spinner label="Cargando el resumen…" />;
    if (error) return <SummaryError error={error} onRetry={reload} />;

    if (data.primerAcceso) {
      return (
        <>
          <Welcome />
          <UpcomingBookings rows={[]} firstAccess />
        </>
      );
    }

    const { cifras } = data;
    return (
      <>
        {data.truncado && (
          <Alert type="warning">
            Tienes muchos edificios, plantas o salas: las cifras y las tareas pueden estar
            incompletas.
          </Alert>
        )}
        <div className={styles.stats}>
          <StatCard value={cifras.edificios} label="Edificios" />
          <StatCard value={cifras.salasPublicadas} label="Salas publicadas" />
          <StatCard value={cifras.reservasMes} label="Reservas este mes" />
          <StatCard value={formatPrice(cifras.ingresosMes)} label="Ingresos este mes" />
        </div>
        <div className={styles.columns}>
          <UpcomingBookings rows={data.proximasReservas ?? []} />
          <PendingTasks tasks={buildTasks(data.tareas ?? {})} />
        </div>
      </>
    );
  };

  return (
    <PageContainer>
      <h1 className={styles.title}>Resumen</h1>
      <div className={styles.content}>{renderContent()}</div>
    </PageContainer>
  );
}
