// Empresas del panel de admin (wireframes 17, 17c y 17d, adaptados a la API): filtro de estado (en la URL,
// `?estado=pendiente`), tabla y acciones según el estado: aprobar o rechazar (pendiente), suspender (aprobada) y
// reactivar (suspendida). Rechazar y suspender piden motivo. Suspender no cancela reservas: la API devuelve el aviso.
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import ConfirmModal from '@/components/ui/ConfirmModal/ConfirmModal.jsx';
import DataTable from '@/components/ui/DataTable/DataTable.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import FilterBar from '@/components/ui/FilterBar/FilterBar.jsx';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge.jsx';
import Textarea from '@/components/ui/Textarea/Textarea.jsx';
import { COMPANY_STATUS } from '@/config/constants.js';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import {
  approveCompany,
  listCompanies,
  reactivateCompany,
  rejectCompany,
  suspendCompany,
} from '@/services/adminService.js';
import styles from './AdminCompanies.module.css';

const MOTIVO_MIN = 3;
const MOTIVO_MAX = 500;

// Estado de la API (español) → estado de StatusBadge.
const BADGE_STATUS = {
  pendiente: COMPANY_STATUS.PENDING,
  aprobada: COMPANY_STATUS.VERIFIED,
  rechazada: COMPANY_STATUS.REJECTED,
  suspendida: COMPANY_STATUS.SUSPENDED,
};

const ESTADOS = Object.keys(BADGE_STATUS);

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

// Cada acción: textos del modal, si pide motivo, la llamada a la API y el mensaje de éxito.
const ACTIONS = {
  approve: {
    label: 'Aprobar',
    title: (nombre) => `¿Aprobar ${nombre}?`,
    text: 'Podrá entrar en su panel y publicar sus edificios.',
    confirmLabel: 'Aprobar',
    call: (company) => approveCompany(company.id, { version: company.version }),
    done: (nombre) => `${nombre} está aprobada.`,
  },
  reject: {
    label: 'Rechazar',
    title: (nombre) => `Rechazar ${nombre}`,
    text: 'La solicitud queda rechazada. La empresa podrá corregir sus datos y volver a enviarla.',
    confirmLabel: 'Rechazar',
    needsMotivo: true,
    call: (company, motivo) => rejectCompany(company.id, motivo, { version: company.version }),
    done: (nombre) => `${nombre} está rechazada.`,
  },
  suspend: {
    label: 'Suspender',
    title: (nombre) => `Suspender ${nombre}`,
    text: 'Sus edificios dejarán de verse en iPuente. Las reservas futuras no se cancelan.',
    confirmLabel: 'Suspender',
    needsMotivo: true,
    call: (company, motivo) => suspendCompany(company.id, motivo),
    done: (nombre) => `${nombre} está suspendida.`,
  },
  reactivate: {
    label: 'Reactivar',
    title: (nombre) => `¿Reactivar ${nombre}?`,
    text: 'Sus edificios publicados vuelven a verse en iPuente.',
    confirmLabel: 'Reactivar',
    call: (company) => reactivateCompany(company.id),
    done: (nombre) => `${nombre} está activa de nuevo.`,
  },
};

// Acciones posibles en cada estado (rechazada no tiene ninguna).
const ACTIONS_BY_ESTADO = {
  pendiente: ['approve', 'reject'],
  aprobada: ['suspend'],
  suspendida: ['reactivate'],
};

const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : DATE_FORMAT.format(date).replace(/\./g, '');
}

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
  { key: 'fechaSolicitud', label: 'Solicitud', render: (row) => formatDate(row.fechaSolicitud) },
  {
    key: 'estado',
    label: 'Estado',
    render: (row) => <StatusBadge kind="company" status={BADGE_STATUS[row.estado]} />,
  },
];

// Mensaje del error de la API dentro del modal.
function errorMessage(error) {
  if (error?.code === 'INVALID_TRANSITION') {
    return 'Esta empresa ha cambiado de estado. Hemos actualizado la lista.';
  }
  if (error?.code === 'NETWORK_ERROR') return 'No hay conexión. Inténtalo de nuevo.';
  return error?.message || 'No se ha podido completar la acción. Inténtalo de nuevo.';
}

export default function AdminCompanies() {
  usePageTitle('Empresas');
  const [searchParams, setSearchParams] = useSearchParams();
  const estadoParam = searchParams.get('estado') ?? '';
  const estado = ESTADOS.includes(estadoParam) ? estadoParam : '';

  const { data, error, loading, reload } = useFetch(
    (signal) => listCompanies(estado, { signal }),
    `companies-${estado}`,
  );

  // Modal abierto: { type, company }. `motivo`, `sending` y `actionError` son del modal; `notice`, el aviso de arriba.
  const [pending, setPending] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);

  const action = pending ? ACTIONS[pending.type] : null;
  const motivoTrimmed = motivo.trim();
  const motivoValid = motivoTrimmed.length >= MOTIVO_MIN && motivoTrimmed.length <= MOTIVO_MAX;

  const changeFilter = (name, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    setSearchParams(next, { replace: true });
  };

  const openAction = (type, company) => {
    setPending({ type, company });
    setMotivo('');
    setActionError(null);
  };

  const closeAction = () => {
    if (sending) return;
    setPending(null);
  };

  const confirmAction = async () => {
    if (!pending || (action.needsMotivo && !motivoValid)) return;
    setSending(true);
    setActionError(null);
    try {
      const result = await action.call(pending.company, motivoTrimmed);
      const nombre = result?.nombre || pending.company.nombre;
      setNotice(
        result?.aviso
          ? { type: 'warning', text: `${action.done(nombre)} ${result.aviso}` }
          : { type: 'success', text: action.done(nombre) },
      );
      setPending(null);
      reload();
    } catch (err) {
      if (err?.code === 'STALE_DATA') {
        // La empresa cambió sus datos: se cierra el modal (su `version` ya no vale) y se recarga para revisarlos.
        setNotice({ type: 'warning', text: errorMessage(err) });
        setPending(null);
        reload();
      } else {
        setActionError(err);
        if (err?.code === 'INVALID_TRANSITION') reload();
      }
    } finally {
      setSending(false);
    }
  };

  const rowActions = (company) => {
    const nombre = company.nombre || 'esta empresa';
    return (
      <>
        {(ACTIONS_BY_ESTADO[company.estado] ?? []).map((type) => (
          <Button
            key={type}
            variant="secondary"
            size="md"
            onClick={() => openAction(type, company)}
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

  // Error de validación del motivo (400 VALIDATION_ERROR): va bajo el campo; el resto, en el Alert del modal.
  const motivoError =
    actionError?.code === 'VALIDATION_ERROR'
      ? (actionError.details?.find?.((d) => d.field === 'motivo')?.message ?? actionError.message)
      : undefined;
  const modalError = actionError && !motivoError ? errorMessage(actionError) : null;

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

      <ConfirmModal
        open={Boolean(pending)}
        onClose={closeAction}
        title={action ? action.title(pending.company.nombre || 'esta empresa') : ''}
        text={action?.text}
        confirmLabel={action?.confirmLabel}
        onConfirm={confirmAction}
        confirmDisabled={Boolean(action?.needsMotivo) && !motivoValid}
        loading={sending}
      >
        {modalError && <Alert type="error">{modalError}</Alert>}
        {action?.needsMotivo && (
          <Textarea
            label="Motivo (obligatorio)"
            hint={`La empresa lo verá en el estado de su solicitud. ${motivo.length}/${MOTIVO_MAX}`}
            error={motivoError}
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            maxLength={MOTIVO_MAX}
            required
          />
        )}
      </ConfirmModal>
    </PageContainer>
  );
}
