// Resumen del panel de admin (/admin, wireframe 16 adaptado a la API): cuatro cifras de GET /admin/summary y la tabla
// de empresas pendientes de aprobación (las 5 primeras de listCompanies('pendiente')) con «Ver» y «Aprobar»
// (CompanyActionModal, el mismo que la lista y el detalle). Sin «Actividad reciente»: la API no la tiene.
// «Volumen cobrado este mes» sale de `ingresosMes.total` (pagos cobrados del mes); sin cifra, «—».
import { useRef, useState } from 'react';
import CompanyActionModal from '@/components/admin/CompanyActionModal/CompanyActionModal.jsx';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import DataTable from '@/components/ui/DataTable/DataTable.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import StatCard from '@/components/ui/StatCard/StatCard.jsx';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { getSummary, listCompanies } from '@/services/adminService.js';
import { ACTIONS, formatCompanyDate } from '@/utils/companyActions.js';
import { formatPrice } from '@/utils/formatPrice.js';
import styles from './AdminDashboard.module.css';

// Empresas pendientes que se enseñan en el resumen; el resto, en «Ver todas».
const PENDING_SHOWN = 5;

const COLUMNS = [
  {
    key: 'nombre',
    label: 'Empresa',
    render: (row) => <span className={styles.companyName}>{row.nombre || 'Sin nombre'}</span>,
  },
  { key: 'cif', label: 'CIF', render: (row) => row.cif || '—' },
  {
    key: 'fechaSolicitud',
    label: 'Fecha de solicitud',
    render: (row) => formatCompanyDate(row.fechaSolicitud),
  },
];

const number = new Intl.NumberFormat('es-ES');

function Stats({ summary, loading, error, onRetry }) {
  if (loading && !summary) return <Spinner label="Cargando cifras…" />;
  if (error) {
    return <ErrorState error={error} title="No hemos podido cargar las cifras" onRetry={onRetry} />;
  }
  const empresas = summary.empresas ?? {};
  const total = Object.values(empresas).reduce((sum, n) => sum + (Number(n) || 0), 0);
  const reservas = summary.reservasMes ?? {};
  // Sin cifra de ingresos (la API no pudo calcularla): «—», no 0,00 €.
  const ingresosTotal = summary.ingresosMes?.total;
  const ingresos = Number.isFinite(ingresosTotal) ? formatPrice(ingresosTotal) : '—';

  // `reservas.total` sale de recuentos exactos; `truncado` solo afecta al reparto pendiente/caducada, que no se enseña.
  return (
    <div className={styles.stats}>
      <StatCard value={number.format(total)} label="Empresas" />
      <StatCard value={number.format(empresas.pendiente ?? 0)} label="Pendientes de aprobar" />
      <StatCard value={number.format(reservas.total ?? 0)} label="Reservas este mes" />
      <StatCard value={ingresos} label="Volumen cobrado este mes" />
    </div>
  );
}

export default function AdminDashboard() {
  usePageTitle('Panel de administración');

  const summary = useFetch((signal) => getSummary({ signal }), 'admin-summary');
  const pendingList = useFetch(
    (signal) => listCompanies('pendiente', { signal }),
    'admin-pending-companies',
  );

  // Al recargar tras aprobar se siguen mostrando los últimos datos (así la tabla no parpadea).
  const [lastSummary, setLastSummary] = useState(null);
  if (summary.data && summary.data !== lastSummary) setLastSummary(summary.data);
  const [lastPending, setLastPending] = useState(null);
  if (pendingList.data && pendingList.data !== lastPending) setLastPending(pendingList.data);

  const [pending, setPending] = useState(null);
  const [notice, setNotice] = useState(null);
  const titleRef = useRef(null);

  const reloadAll = () => {
    summary.reload();
    pendingList.reload();
  };

  const finishAction = (result) => {
    setNotice(result);
    setPending(null);
    reloadAll();
    // El botón «Aprobar» desaparece con la fila: el foco va al título de la sección.
    requestAnimationFrame(() => titleRef.current?.focus());
  };

  const companies = (pendingList.data ?? (pendingList.loading ? lastPending : null))?.empresas;
  const shown = companies?.slice(0, PENDING_SHOWN) ?? [];
  const reloading = summary.loading || pendingList.loading;

  const rowActions = (company) => {
    const nombre = company.nombre || 'esta empresa';
    return (
      <>
        <Button
          to={`/admin/companies/${company.id}`}
          variant="ghost"
          size="md"
          aria-label={`Ver ${nombre}`}
        >
          Ver
        </Button>
        <Button
          variant="secondary"
          size="md"
          disabled={reloading}
          onClick={() => setPending({ type: 'approve', company })}
          aria-label={`${ACTIONS.approve.label} ${nombre}`}
        >
          {ACTIONS.approve.label}
        </Button>
      </>
    );
  };

  const renderPending = () => {
    if (!companies && pendingList.loading) return <Spinner label="Cargando empresas pendientes…" />;
    if (pendingList.error) {
      return (
        <ErrorState
          error={pendingList.error}
          title="No hemos podido cargar las empresas pendientes"
          onRetry={pendingList.reload}
        />
      );
    }
    return (
      <>
        <DataTable
          caption="Empresas pendientes de aprobación"
          columns={COLUMNS}
          rows={shown}
          actions={rowActions}
          emptyTitle="No hay empresas pendientes"
          emptyText="Cuando una empresa solicite el alta, aparecerá aquí."
        />
        {companies.length > PENDING_SHOWN && (
          <p className={styles.note}>
            Se muestran {PENDING_SHOWN} de {companies.length} empresas pendientes.
          </p>
        )}
      </>
    );
  };

  return (
    <PageContainer>
      <h1 className={styles.title}>Resumen</h1>
      <div className={styles.content}>
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

        <Stats
          summary={summary.data ?? (summary.loading ? lastSummary : null)}
          loading={summary.loading}
          error={summary.error}
          onRetry={summary.reload}
        />

        <section className={styles.panel} aria-labelledby="pending-companies">
          <div className={styles.panelHeader}>
            <h2 id="pending-companies" ref={titleRef} tabIndex={-1} className={styles.sectionTitle}>
              Empresas pendientes de aprobación
            </h2>
            <Button to="/admin/companies?estado=pendiente" variant="ghost" size="md">
              Ver todas →
            </Button>
          </div>
          {renderPending()}
        </section>
      </div>

      {pending && (
        <CompanyActionModal
          type={pending.type}
          company={pending.company}
          onClose={() => setPending(null)}
          onDone={finishAction}
          onChanged={reloadAll}
          refreshed="la lista"
        />
      )}
    </PageContainer>
  );
}
