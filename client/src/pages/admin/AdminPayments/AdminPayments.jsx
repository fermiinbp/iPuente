// Pagos del panel de admin: tabla con reserva, cliente, importe, fecha, estado y reembolso pendiente. Filtro de
// estado y página en la URL (`?estado=SUCCEEDED&page=2`). Reembolso total de los pagos `SUCCEEDED` (también los que
// tienen el reembolso pendiente de un intento anterior) con `ConfirmModal`.
import { useRef, useState } from 'react';
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
import { PAYMENT_STATUS } from '@/config/constants.js';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { listPayments, refundPayment } from '@/services/adminService.js';
import { formatPrice } from '@/utils/formatPrice.js';
import styles from './AdminPayments.module.css';

const MAX_PAGE = 25;
const ESTADOS = Object.values(PAYMENT_STATUS);

const FILTERS = [
  {
    name: 'estado',
    label: 'Estado',
    options: [
      { value: '', label: 'Todos' },
      { value: PAYMENT_STATUS.SUCCEEDED, label: 'Pagados' },
      { value: PAYMENT_STATUS.REFUNDED, label: 'Reembolsados' },
      { value: PAYMENT_STATUS.PENDING, label: 'Pendientes' },
      { value: PAYMENT_STATUS.FAILED, label: 'Fallidos' },
    ],
  },
];

const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : DATE_FORMAT.format(date).replace(/\./g, '');
}

// Mensaje en español del error del reembolso.
function refundErrorMessage(error) {
  switch (error?.code) {
    case 'PAYMENT_NOT_REFUNDABLE':
      return 'Este pago ya no se puede reembolsar. Hemos actualizado la lista.';
    case 'NOT_FOUND':
      return 'No encontramos este pago. Hemos actualizado la lista.';
    case 'PAYMENTS_ERROR':
      return 'Stripe no ha podido hacer el reembolso. Queda pendiente: puedes reintentarlo.';
    case 'PAYMENTS_UNAVAILABLE':
      return 'El servicio de pagos no está disponible ahora mismo. Inténtalo más tarde.';
    case 'NETWORK_ERROR':
      return 'No hay conexión. Inténtalo de nuevo.';
    default:
      return error?.message || 'No se ha podido hacer el reembolso. Inténtalo de nuevo.';
  }
}

const COLUMNS = [
  {
    key: 'reserva',
    label: 'Reserva',
    render: (row) =>
      row.reserva ? (
        <span className={styles.stack}>
          <span className={styles.strong}>{row.reserva.codigo || 'Sin código'}</span>
          <StatusBadge kind="booking" status={row.reserva.estado} />
        </span>
      ) : (
        '—'
      ),
  },
  {
    key: 'cliente',
    label: 'Cliente',
    render: (row) =>
      row.cliente ? (
        <span className={styles.stack}>
          <span className={styles.strong}>{row.cliente.nombre || 'Sin nombre'}</span>
          {row.cliente.email && <span className={styles.muted}>{row.cliente.email}</span>}
        </span>
      ) : (
        '—'
      ),
  },
  { key: 'importe', label: 'Importe', render: (row) => formatPrice(row.importe) },
  { key: 'fecha', label: 'Fecha', render: (row) => formatDate(row.fecha) },
  {
    key: 'estado',
    label: 'Estado',
    render: (row) => (
      <span className={styles.badges}>
        <StatusBadge kind="payment" status={row.estado} />
        {row.reembolsoPendiente && <StatusBadge kind="booking" status="REFUND_PENDING" />}
      </span>
    ),
  },
  {
    key: 'reembolso',
    label: 'Reembolso',
    render: (row) => {
      if (row.estado === PAYMENT_STATUS.REFUNDED) {
        return row.reembolsadoEn ? `Hecho el ${formatDate(row.reembolsadoEn)}` : 'Hecho';
      }
      if (row.reembolsoPendiente) {
        return (
          <span className={styles.stack}>
            <span>Pendiente</span>
            {row.motivoReembolso && <span className={styles.muted}>{row.motivoReembolso}</span>}
          </span>
        );
      }
      return '—';
    },
  },
];

export default function AdminPayments() {
  usePageTitle('Pagos');
  const [searchParams, setSearchParams] = useSearchParams();
  const estadoParam = searchParams.get('estado') ?? '';
  const estado = ESTADOS.includes(estadoParam) ? estadoParam : '';
  const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? Math.min(pageParam, MAX_PAGE) : 1;

  const { data, error, loading, reload } = useFetch(
    (signal) => listPayments({ estado, page }, { signal }),
    `payments-${estado}-${page}`,
  );

  const [toRefund, setToRefund] = useState(null);
  const [sending, setSending] = useState(false);
  // Cerrojo inmediato contra el doble clic en «Reembolsar».
  const refundLock = useRef(false);
  const [refundError, setRefundError] = useState(null);
  const [notice, setNotice] = useState(null);

  const setParam = (name, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, String(value));
    else next.delete(name);
    return next;
  };

  const changeFilter = (name, value) => {
    const next = setParam(name, value);
    next.delete('page');
    setSearchParams(next, { replace: true });
    setNotice(null);
  };

  const goToPage = (target) => {
    setSearchParams(setParam('page', target > 1 ? target : ''), { replace: true });
  };

  const closeRefund = () => {
    if (sending) return;
    setToRefund(null);
    setRefundError(null);
  };

  const confirmRefund = async () => {
    if (!toRefund || refundLock.current) return;
    refundLock.current = true;
    setSending(true);
    setRefundError(null);
    try {
      const result = await refundPayment(toRefund.id);
      setNotice({
        type: 'success',
        text: result?.yaReembolsado
          ? 'Este pago ya estaba reembolsado. Hemos actualizado la lista.'
          : `Pago de ${formatPrice(toRefund.importe)} reembolsado. La reserva queda cancelada.`,
      });
      setToRefund(null);
      reload();
    } catch (err) {
      setRefundError(err);
      // Si el pago cambió o no existe, se recarga la lista; con un 502 queda pendiente y se puede reintentar.
      if (['PAYMENT_NOT_REFUNDABLE', 'NOT_FOUND'].includes(err?.code)) reload();
      if (err?.code === 'PAYMENTS_ERROR') reload();
    } finally {
      refundLock.current = false;
      setSending(false);
    }
  };

  const rowActions = (payment) => {
    if (payment.estado !== PAYMENT_STATUS.SUCCEEDED) return null;
    const label = payment.reserva?.codigo ? `la reserva ${payment.reserva.codigo}` : 'este pago';
    return (
      <Button
        variant="secondary"
        size="md"
        onClick={() => {
          setRefundError(null);
          setToRefund(payment);
        }}
        aria-label={`Reembolsar ${label}`}
      >
        Reembolsar
      </Button>
    );
  };

  const renderList = () => {
    if (loading) return <Spinner label="Cargando pagos…" />;
    if (error) {
      return <ErrorState error={error} title="No hemos podido cargar los pagos" onRetry={reload} />;
    }
    const total = data?.total ?? 0;
    const limit = data?.limit || 20;
    const lastPage = Math.min(Math.max(Math.ceil(total / limit), 1), MAX_PAGE);
    return (
      <>
        {data?.truncado && (
          <Alert type="warning">
            Hay más pagos de los que se pueden listar. Usa el filtro de estado para acotar la lista.
          </Alert>
        )}
        <DataTable
          caption="Pagos de iPuente"
          columns={COLUMNS}
          rows={data?.pagos ?? []}
          actions={rowActions}
          emptyTitle="No hay pagos"
          emptyText={estado ? 'Prueba con otro estado.' : undefined}
        />
        {total > 0 && (
          <nav className={styles.pager} aria-label="Paginación de pagos">
            <p className={styles.pagerInfo}>
              Página {page} de {lastPage} · {total} {total === 1 ? 'pago' : 'pagos'}
            </p>
            <div className={styles.pagerButtons}>
              <Button
                variant="secondary"
                size="md"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
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
      <h1 className={styles.title}>Pagos</h1>
      <div className={styles.content}>
        <FilterBar filters={FILTERS} values={{ estado }} onChange={changeFilter} />

        {notice && (
          <div>
            <Alert type={notice.type}>{notice.text}</Alert>
          </div>
        )}

        {renderList()}
      </div>

      <ConfirmModal
        open={Boolean(toRefund)}
        onClose={closeRefund}
        title={
          toRefund
            ? `¿Reembolsar ${formatPrice(toRefund.importe)}${toRefund.cliente?.nombre ? ` a ${toRefund.cliente.nombre}` : ''}?`
            : ''
        }
        text="Se devuelve el importe completo por Stripe y la reserva queda cancelada. No se puede deshacer."
        confirmLabel="Reembolsar"
        onConfirm={confirmRefund}
        loading={sending}
      >
        {refundError && <Alert type="error">{refundErrorMessage(refundError)}</Alert>}
      </ConfirmModal>
    </PageContainer>
  );
}
