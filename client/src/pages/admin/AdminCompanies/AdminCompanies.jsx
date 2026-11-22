// Empresas del panel de admin (wireframes 17, 17c y 17d, adaptados a la API): filtro de estado (en la URL,
// `?estado=pendiente`), tabla y acciones según el estado: aprobar o rechazar (pendiente), suspender (aprobada) y
// reactivar (suspendida). Rechazar y suspender piden motivo. Suspender no cancela reservas: la API devuelve el aviso.
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import CompanyActionModal from '@/components/admin/CompanyActionModal/CompanyActionModal.jsx';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import DataTable from '@/components/ui/DataTable/DataTable.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import FilterBar from '@/components/ui/FilterBar/FilterBar.jsx';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge.jsx';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { listCompanies } from '@/services/adminService.js';
import {
  ACTIONS,
  BADGE_STATUS,
  ESTADOS,
  actionsFor,
  formatCompanyDate,
} from '@/utils/companyActions.js';
import styles from './AdminCompanies.module.css';

const FILTERS = [
  {
    name: 'estado',
    label: 'Estado',
    options: [
      { value: '', label: 'Todas' },
      { value: 'pendiente', label: 'Pendientes' },
      { value: 'aprobada', label: 'Aprobadas' },
      { value: 'rechazada', label: 'Rechazadas' },
      { value: 'suspendida', label: 'Suspendidas' },
    ],
  },
];

const EMPTY_TITLES = {
  '': 'No hay empresas',
  pendiente: 'No hay empresas pendientes',
  aprobada: 'No hay empresas aprobadas',
  rechazada: 'No hay empresas rechazadas',
  suspendida: 'No hay empresas suspendidas',
};

const COLUMNS = [
  {
    key: 'nombre',
    label: 'Empresa',
    render: (row) => (
      <span className={styles.company}>
        <span className={styles.companyName}>{row.nombre || 'Sin nombre'}</span>
        {row.email && <span className={styles.companyEmail}>{row.email}</span>}
      </span>
    ),
  },
  { key: 'cif', label: 'CIF', render: (row) => row.cif || '—' },
  {
    key: 'fechaSolicitud',
    label: 'Solicitud',
    render: (row) => formatCompanyDate(row.fechaSolicitud),
  },
  {
    key: 'estado',
    label: 'Estado',
    render: (row) => <StatusBadge kind="company" status={BADGE_STATUS[row.estado]} />,
  },
];

export default function AdminCompanies() {
  usePageTitle('Empresas');
  const [searchParams, setSearchParams] = useSearchParams();
  const estadoParam = searchParams.get('estado') ?? '';
  const estado = ESTADOS.includes(estadoParam) ? estadoParam : '';

  const { data, error, loading, reload } = useFetch(
    (signal) => listCompanies(estado, { signal }),
    `companies-${estado}`,
  );

  // Modal abierto: { type, company }; `notice`, el aviso de arriba.
  const [pending, setPending] = useState(null);
  const [notice, setNotice] = useState(null);

  const changeFilter = (name, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    setSearchParams(next, { replace: true });
  };

  const finishAction = (result) => {
    setNotice(result);
    setPending(null);
    reload();
  };

  const rowActions = (company) => {
    const nombre = company.nombre || 'esta empresa';
    return (
      <>
        {actionsFor(company.estado).map((type) => (
          <Button
            key={type}
            variant="secondary"
            size="md"
            onClick={() => setPending({ type, company })}
            aria-label={`${ACTIONS[type].label} ${nombre}`}
          >
            {ACTIONS[type].label}
          </Button>
        ))}
        <Button
          to={`/admin/companies/${company.id}`}
          variant="ghost"
          size="md"
          aria-label={`Ver ${nombre}`}
        >
          Ver
        </Button>
      </>
    );
  };

  const renderList = () => {
    if (loading) return <Spinner label="Cargando empresas…" />;
    if (error) {
      return (
        <ErrorState error={error} title="No hemos podido cargar las empresas" onRetry={reload} />
      );
    }
    return (
      <DataTable
        caption="Empresas registradas en iPuente"
        columns={COLUMNS}
        rows={data?.empresas ?? []}
        actions={rowActions}
        emptyTitle={EMPTY_TITLES[estado]}
      />
    );
  };

  return (
    <PageContainer>
      <h1 className={styles.title}>Empresas</h1>
      <div className={styles.content}>
        <FilterBar filters={FILTERS} values={{ estado }} onChange={changeFilter} />

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

        {renderList()}
      </div>

      {pending && (
        <CompanyActionModal
          type={pending.type}
          company={pending.company}
          onClose={() => setPending(null)}
          onDone={finishAction}
          onChanged={reload}
        />
      )}
    </PageContainer>
  );
}
