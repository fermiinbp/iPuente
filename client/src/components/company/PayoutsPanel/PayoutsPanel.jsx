// Pestaña «Cobros» de Ajustes de empresa (Stripe Connect). Lo que se enseña sale siempre de `getPayouts`
// (`estado`: none, pending, active o restricted), nunca de la URL: la vuelta de Stripe (`?stripe=retorno` o
// `?stripe=refrescar`) solo dispara una relectura y un mensaje, y el parámetro se limpia para que recargar no lo repita.
// El enlace de alta y el del panel de Stripe son de un solo uso: se piden al pulsar, nunca antes.
// Los movimientos (pagos de la empresa) se leen aparte, con paginación de 20; se enseñan aunque la cuenta no esté conectada.
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import DataTable from '@/components/ui/DataTable/DataTable.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge.jsx';
import { PAYOUT_ACCOUNT_STATUS } from '@/config/constants.js';
import { useFetch } from '@/hooks/useFetch.js';
import {
  getPayoutMovements,
  getPayouts,
  getPayoutsDashboardLink,
  startPayoutsOnboarding,
} from '@/services/companyService.js';
import { formatPrice } from '@/utils/formatPrice.js';
import styles from './PayoutsPanel.module.css';

const MAX_PAGE = 25;

const BADGE_BY_ESTADO = {
  none: PAYOUT_ACCOUNT_STATUS.NOT_CONNECTED,
  pending: PAYOUT_ACCOUNT_STATUS.PENDING_VERIFICATION,
  active: PAYOUT_ACCOUNT_STATUS.ACTIVE,
  restricted: PAYOUT_ACCOUNT_STATUS.RESTRICTED,
};

const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? '—' : DATE_FORMAT.format(date).replace(/\./g, '');
}

const hasRequirements = (value) => (Array.isArray(value) ? value.length > 0 : Boolean(value));

// Solo se redirige a páginas de Stripe, siempre por https.
function stripeUrl(url) {
  const target = URL.canParse(url ?? '') ? new URL(url) : null;
  const ok = target?.protocol === 'https:' && /(^|\.)stripe\.com$/.test(target.hostname);
  if (!ok) throw new Error('No hemos podido abrir la página de Stripe. Inténtalo de nuevo.');
  return target.href;
}

function errorMessage(error) {
  switch (error?.code) {
    case 'PAYOUTS_ALREADY_ACTIVE':
      return 'Tu cuenta de cobros ya está activa. Hemos actualizado el estado.';
    case 'PAYOUTS_BUSY':
      return 'Ya hay una operación en curso con tu cuenta de cobros. Espera unos segundos e inténtalo de nuevo.';
    case 'PAYOUTS_REQUIRED':
      return 'Todavía no tienes una cuenta de cobros. Conéctala primero.';
    case 'RATE_LIMITED':
      return 'Has hecho demasiados intentos. Espera un poco e inténtalo de nuevo.';
    case 'PAYMENTS_ERROR':
      return 'No hemos podido conectar con Stripe. Inténtalo de nuevo en unos minutos.';
    case 'PAYMENTS_UNAVAILABLE':
      return 'Los cobros con Stripe no están disponibles ahora mismo. Inténtalo más tarde.';
    case 'NETWORK_ERROR':
      return 'No hay conexión. Inténtalo de nuevo.';
    default:
      return error?.message || 'Algo ha fallado. Inténtalo de nuevo.';
  }
}

// Mensaje de la vuelta de Stripe, calculado con el estado que dice la API (no con la URL).
function returnNotice(kind, payouts) {
  if (kind === 'refrescar') {
    return {
      type: 'info',
      text: 'El enlace de Stripe ha caducado o se ha interrumpido. Puedes continuar el alta cuando quieras.',
    };
  }
  if (kind !== 'retorno' || !payouts || payouts.desactualizado) return null;
  switch (payouts.estado) {
    case 'active':
      return { type: 'success', text: 'Tu cuenta de cobros está activa.' };
    case 'pending':
      return {
        type: 'info',
        text: hasRequirements(payouts.requisitosPendientes)
          ? 'Todavía faltan datos por completar en Stripe.'
          : 'Stripe está revisando tus datos. Te lo mostramos aquí en cuanto termine.',
      };
    case 'restricted':
      return {
        type: 'warning',
        text: 'Stripe necesita más información para que tu cuenta pueda cobrar.',
      };
    default:
      return { type: 'warning', text: 'El alta en Stripe no se ha completado.' };
  }
}

function Movements() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useFetch(
    (signal) => getPayoutMovements(page, { signal }),
    `payout-movements-${page}`,
  );

  const columns = [
    {
      key: 'codigoReserva',
      label: 'Reserva',
      render: (row) => row.codigoReserva || '—',
    },
    { key: 'sala', label: 'Sala', render: (row) => row.sala || '—' },
    {
      key: 'fechaReserva',
      label: 'Fecha de reserva',
      render: (row) => formatDate(row.fechaReserva),
    },
    { key: 'fecha', label: 'Fecha de pago', render: (row) => formatDate(row.fecha) },
    { key: 'importe', label: 'Importe', render: (row) => formatPrice(row.importe) },
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
  ];

  let content;
  if (loading) content = <Spinner label="Cargando los movimientos…" />;
  else if (error) {
    content = (
      <ErrorState error={error} title="No hemos podido cargar los movimientos" onRetry={reload} />
    );
  } else {
    const total = data?.total ?? 0;
    const limit = data?.limit || 20;
    const lastPage = Math.min(Math.max(Math.ceil(total / limit), 1), MAX_PAGE);
    content = (
      <>
        {data?.truncado && (
          <Alert type="warning">
            Hay más movimientos de los que se pueden listar. Solo se muestran los más recientes.
          </Alert>
        )}
        <DataTable
          caption="Movimientos de cobros"
          columns={columns}
          rows={data?.movimientos ?? []}
          emptyTitle="Todavía no hay movimientos"
          emptyText="Aquí verás los pagos de tus reservas."
        />
        {total > 0 && (
          <nav className={styles.pager} aria-label="Paginación de movimientos">
            <p className={styles.pagerInfo}>
              Página {page} de {lastPage} · {total} {total === 1 ? 'movimiento' : 'movimientos'}
            </p>
            <div className={styles.pagerButtons}>
              <Button
                variant="secondary"
                size="md"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="md"
                disabled={page >= lastPage}
                onClick={() => setPage(page + 1)}
              >
                Siguiente
              </Button>
            </div>
          </nav>
        )}
      </>
    );
  }

  return (
    <section className={styles.section} aria-labelledby="movimientos-cobros">
      <h2 className={styles.subtitle} id="movimientos-cobros">
        Movimientos
      </h2>
      {content}
    </section>
  );
}

export default function PayoutsPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  // La vuelta de Stripe se recuerda al entrar y se quita de la URL (replace): recargar no repite el mensaje.
  const [returnKind] = useState(() => searchParams.get('stripe'));
  useEffect(() => {
    if (!searchParams.has('stripe')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('stripe');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const { data, error, loading, reload } = useFetch(
    (signal) => getPayouts({ signal }),
    'company-payouts',
  );

  // Cerrojos inmediatos contra el doble clic (el estado se actualiza al repintar).
  const startLock = useRef(false);
  const dashboardLock = useRef(false);
  const [starting, setStarting] = useState(false);
  const [openingDashboard, setOpeningDashboard] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Al volver atrás desde Stripe el navegador puede restaurar la página tal cual: se sueltan los cerrojos.
  useEffect(() => {
    const onPageShow = (event) => {
      if (!event.persisted) return;
      startLock.current = false;
      dashboardLock.current = false;
      setStarting(false);
      setOpeningDashboard(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const go = async (lock, setBusy, request) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setActionError(null);
    try {
      const { url } = await request();
      window.location.assign(stripeUrl(url));
    } catch (err) {
      setActionError(err);
      // Si el estado cambió (ya activa), se relee para enseñar el real.
      if (['PAYOUTS_ALREADY_ACTIVE', 'PAYOUTS_REQUIRED'].includes(err?.code)) reload();
      lock.current = false;
      setBusy(false);
    }
  };
  const start = () => go(startLock, setStarting, () => startPayoutsOnboarding());
  const openDashboard = () =>
    go(dashboardLock, setOpeningDashboard, () => getPayoutsDashboardLink());

  let status;
  if (loading) status = <Spinner label="Comprobando tu cuenta de cobros…" />;
  else if (error) {
    status = (
      <ErrorState
        error={error}
        title="No hemos podido cargar tu cuenta de cobros"
        onRetry={reload}
      />
    );
  } else {
    const { estado, requisitosPendientes, desactualizado, aviso, conectada } = data;
    const notice = returnNotice(returnKind, data);
    const pendingData = hasRequirements(requisitosPendientes);
    let body;
    let primary = null;
    if (desactualizado) {
      body = (
        <p className={styles.text}>
          No hemos podido confirmar el estado actual de tu cuenta de cobros con Stripe.
        </p>
      );
      primary = (
        <Button variant="secondary" size="md" onClick={reload}>
          Comprobar de nuevo
        </Button>
      );
    } else if (estado === 'active') {
      body = (
        <p className={styles.text}>
          Tu cuenta está activa: ya puedes publicar salas de pago y cobrar sus reservas.
        </p>
      );
    } else if (estado === 'restricted') {
      body = (
        <p className={styles.text}>
          Stripe ha limitado tu cuenta y no puede recibir cobros hasta que completes la información
          que te pide. Mientras tanto, las salas de pago no se pueden publicar ni reservar.
        </p>
      );
      primary = (
        <Button size="md" loading={starting} onClick={start}>
          Completar datos en Stripe
        </Button>
      );
    } else if (estado === 'pending') {
      body = pendingData ? (
        <p className={styles.text}>
          Has empezado el alta, pero faltan datos por completar en Stripe.
        </p>
      ) : (
        <p className={styles.text}>Stripe está revisando tus datos. Suele tardar poco.</p>
      );
      primary = pendingData ? (
        <Button size="md" loading={starting} onClick={start}>
          Continuar el alta
        </Button>
      ) : (
        <Button variant="secondary" size="md" onClick={reload}>
          Comprobar de nuevo
        </Button>
      );
    } else {
      body = (
        <p className={styles.text}>
          Conecta tu cuenta con Stripe para recibir el dinero de las reservas de tus salas de pago.
          Las salas gratis no la necesitan.
        </p>
      );
      primary = (
        <Button size="md" loading={starting} onClick={start}>
          Conectar con Stripe
        </Button>
      );
    }

    status = (
      <>
        {notice && <Alert type={notice.type}>{notice.text}</Alert>}
        {desactualizado && (
          <Alert type="warning">
            {aviso || 'La información de tu cuenta puede no estar al día.'}
          </Alert>
        )}
        <div className={styles.statusRow}>
          <h3 className={styles.statusTitle}>Estado de la cuenta</h3>
          {!desactualizado && BADGE_BY_ESTADO[estado] && (
            <StatusBadge kind="payoutAccount" status={BADGE_BY_ESTADO[estado]} />
          )}
        </div>
        {body}
        <div className={styles.actions}>
          {primary}
          {conectada && (
            <Button
              variant="secondary"
              size="md"
              loading={openingDashboard}
              onClick={openDashboard}
            >
              Ir a mi panel de Stripe
            </Button>
          )}
        </div>
      </>
    );
  }

  return (
    <div className={styles.panel}>
      <section className={styles.section} aria-labelledby="cuenta-cobros">
        <h2 className={styles.subtitle} id="cuenta-cobros">
          Cuenta de cobros
        </h2>
        <p className={styles.note}>
          Estamos en modo prueba: no se mueve dinero real. iPuente no te cobra comisión.
        </p>
        {actionError && <Alert type="error">{errorMessage(actionError)}</Alert>}
        {status}
      </section>
      <Movements />
    </div>
  );
}
