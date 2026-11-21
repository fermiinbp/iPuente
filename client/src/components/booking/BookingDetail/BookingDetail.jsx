// Detalle de una reserva, común a cliente, empresa y admin (UI014). El rol (`role`) decide los datos y las acciones;
// no habla con la API: quien lo usa le pasa la reserva y las acciones, y pone el contenedor (página o SidePanel).
// - Cliente (por defecto, página `/bookings/:id`): código, sala, fecha y franja, planta y edificio, cómo llegar, pago
//   y política de cancelación. Acciones: cancelar (`onCancel`, solo reservas confirmadas que no han empezado) y
//   «Pagar ahora» (pendiente de pago, lleva a `/checkout/:id`).
// - Empresa (wireframe 15b): sala y planta, fecha, horario, cliente, su email e importe. Acciones: «Cancelar reserva»
//   (`onCancel`, mismas condiciones) y «Escribir al cliente» (correo). Un bloqueo (`tipo: 'bloqueo'`) enseña sala,
//   fecha, horario y motivo, con «Quitar bloqueo» (`onRemoveBlock`).
// - Admin (wireframe 19b): sala y planta, edificio, empresa, cliente, fecha y horario e importe. Acción: «Ver empresa».
// Una acción sin su función no se pinta. Lo que la API no tiene no se muestra (asistentes, desglose de comisiones,
// historial y reembolso). Dentro de un SidePanel: `showHeader={false}`, y el título y el estado los pone el panel con
// `detailTitle` y `detailStatus` (utils/bookingDetail.js).
import Button from '@/components/ui/Button/Button.jsx';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge.jsx';
import { BOOKING_STATUS, ROLES } from '@/config/constants.js';
import { cancellationText, detailStatus, detailTitle, isBlock } from '@/utils/bookingDetail.js';
import { formatLongDate, hasStarted } from '@/utils/dates.js';
import { priceLabel } from '@/utils/formatPrice.js';
import styles from './BookingDetail.module.css';

const pad = (hour) => String(hour).padStart(2, '0');
const slot = (booking) => `${pad(booking.inicio)}:00 – ${pad(booking.fin)}:00`;
const join = (...parts) => parts.filter(Boolean).join(' · ');
const roomLine = (booking) =>
  join(booking.sala?.codigo, booking.sala?.nombre, booking.planta?.nombre);

// Se puede cancelar una reserva confirmada que todavía no ha empezado.
const isCancellable = (booking) =>
  booking.estado === BOOKING_STATUS.CONFIRMED && !hasStarted(booking);

// Filas «Etiqueta … valor» de empresa y admin. Las que no tienen valor no se pintan.
function Rows({ rows }) {
  return (
    <dl className={styles.rows}>
      {rows
        .filter((row) => row.value)
        .map((row) => (
          <div key={row.label} className={styles.row}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
    </dl>
  );
}

function PanelHeader({ booking, role }) {
  return (
    <div className={styles.panelHead}>
      <h2 className={styles.panelTitle}>{detailTitle(booking)}</h2>
      <StatusBadge status={detailStatus(booking, role)} kind="booking" />
    </div>
  );
}

function Cancelled({ booking, role }) {
  if (booking.estado !== BOOKING_STATUS.CANCELLED) return null;
  return (
    <p className={styles.cancelled} role="status">
      {cancellationText(booking, role)}
    </p>
  );
}

function BlockDetail({ booking, showHeader, onRemoveBlock }) {
  return (
    <div className={styles.panel}>
      {showHeader && <PanelHeader booking={booking} role={ROLES.COMPANY} />}
      <Rows
        rows={[
          { label: 'Sala', value: roomLine(booking) },
          { label: 'Fecha', value: formatLongDate(booking.fecha) },
          { label: 'Horario', value: slot(booking) },
          { label: 'Motivo', value: booking.motivo },
        ]}
      />
      <p className={styles.note}>Los clientes no pueden reservar la sala en este horario.</p>
      {onRemoveBlock && (
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => onRemoveBlock(booking)}>
            Quitar bloqueo
          </Button>
        </div>
      )}
    </div>
  );
}

function CompanyDetail({ booking, showHeader, onCancel }) {
  const email = booking.cliente?.email;
  const canCancel = Boolean(onCancel) && isCancellable(booking);
  return (
    <div className={styles.panel}>
      {showHeader && <PanelHeader booking={booking} role={ROLES.COMPANY} />}
      <Cancelled booking={booking} role={ROLES.COMPANY} />
      <Rows
        rows={[
          { label: 'Sala', value: roomLine(booking) },
          { label: 'Fecha', value: formatLongDate(booking.fecha) },
          { label: 'Horario', value: slot(booking) },
          { label: 'Cliente', value: booking.cliente?.nombre },
          { label: 'Email del cliente', value: email },
          { label: 'Importe', value: priceLabel(booking.importe) },
        ]}
      />
      {(canCancel || email) && (
        <div className={styles.actions}>
          {canCancel && (
            <Button variant="secondary" onClick={() => onCancel(booking)}>
              Cancelar reserva
            </Button>
          )}
          {email && (
            <a className={styles.link} href={`mailto:${email}`}>
              Escribir al cliente
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function AdminDetail({ booking, showHeader }) {
  const empresa = booking.empresa;
  return (
    <div className={styles.panel}>
      {showHeader && <PanelHeader booking={booking} role={ROLES.ADMIN} />}
      <Cancelled booking={booking} role={ROLES.ADMIN} />
      <Rows
        rows={[
          { label: 'Sala', value: roomLine(booking) },
          { label: 'Edificio', value: booking.edificio?.nombre },
          { label: 'Empresa', value: empresa?.nombre },
          { label: 'Cliente', value: join(booking.cliente?.nombre, booking.cliente?.email) },
          { label: 'Fecha', value: `${formatLongDate(booking.fecha)} · ${slot(booking)}` },
          { label: 'Importe', value: priceLabel(booking.importe) },
        ]}
      />
      {empresa?.id && (
        <div className={styles.actions}>
          <Button variant="secondary" to={`/admin/companies/${encodeURIComponent(empresa.id)}`}>
            Ver empresa
          </Button>
        </div>
      )}
    </div>
  );
}

function ClientDetail({ booking, showHeader, onCancel }) {
  const canCancel = Boolean(onCancel) && isCancellable(booking);
  const canPay = booking.estado === BOOKING_STATUS.PENDING_PAYMENT && !hasStarted(booking);
  const place = [booking.edificio?.direccion, booking.edificio?.ciudad].filter(Boolean).join(', ');
  const mapsQuery = `${booking.edificio?.nombre ?? ''} ${place}`.trim();
  const mapsUrl = place
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
    : null;
  const hours = `${booking.horas} ${booking.horas === 1 ? 'hora' : 'horas'}`;

  return (
    <div className={styles.detail}>
      {showHeader && (
        <div className={styles.head}>
          <div>
            {booking.codigo && <p className={styles.code}>Reserva {booking.codigo}</p>}
            <h1 className={styles.title}>{booking.sala?.nombre ?? 'Sala'}</h1>
          </div>
          <StatusBadge status={detailStatus(booking, ROLES.CLIENT)} kind="booking" />
        </div>
      )}

      <Cancelled booking={booking} role={ROLES.CLIENT} />

      <div className={styles.layout}>
        <div className={styles.main}>
          <dl className={styles.facts}>
            <div>
              <dt>Fecha</dt>
              <dd>{formatLongDate(booking.fecha)}</dd>
            </div>
            <div>
              <dt>Horario</dt>
              <dd>
                {slot(booking)} ({hours})
              </dd>
            </div>
            <div>
              <dt>Sala</dt>
              <dd>{join(booking.sala?.codigo, booking.sala?.nombre) || '—'}</dd>
            </div>
            <div>
              <dt>Planta y edificio</dt>
              <dd>{join(booking.planta?.nombre, booking.edificio?.nombre) || '—'}</dd>
            </div>
          </dl>

          <section className={styles.block} aria-labelledby="como-llegar">
            <h2 className={styles.subtitle} id="como-llegar">
              Cómo llegar
            </h2>
            {place ? (
              <>
                <p className={styles.text}>{place}</p>
                <a className={styles.link} href={mapsUrl} target="_blank" rel="noopener noreferrer">
                  Abrir en el mapa
                  <span className={styles.srOnly}> (se abre en una pestaña nueva)</span>
                </a>
              </>
            ) : (
              <p className={styles.text}>La dirección del edificio no está disponible.</p>
            )}
          </section>
        </div>

        <aside className={styles.side} aria-labelledby="pago-titulo">
          <div className={styles.payBox}>
            <h2 className={styles.subtitle} id="pago-titulo">
              Pago
            </h2>
            <dl className={styles.prices}>
              <div>
                <dt>
                  {booking.precioHora === 0
                    ? `${hours} h`
                    : `${priceLabel(booking.precioHora)} × ${hours}`}
                </dt>
                <dd>{priceLabel(booking.importe)}</dd>
              </div>
              <div className={styles.total}>
                <dt>Total</dt>
                <dd>{priceLabel(booking.importe)}</dd>
              </div>
            </dl>
            {canPay && (
              <Button to={`/checkout/${encodeURIComponent(booking.id)}`}>Pagar ahora</Button>
            )}
            <Button variant="secondary" disabled aria-describedby="factura-nota">
              Descargar factura
            </Button>
            <p className={styles.note} id="factura-nota">
              La factura estará disponible cuando se active el pago online.
            </p>
            {canCancel && (
              <Button variant="ghost" onClick={() => onCancel(booking)}>
                Cancelar reserva
              </Button>
            )}
            {booking.estado === BOOKING_STATUS.CANCELLED && (
              <Button to="/search">Buscar otra sala</Button>
            )}
            {booking.sala?.id && (
              <Button variant="ghost" to={`/rooms/${booking.sala.id}`}>
                Ver la sala
              </Button>
            )}
          </div>
          <p className={styles.policy}>
            Puedes cancelar mientras la reserva no haya empezado. Las horas quedan libres para otras
            personas.
          </p>
        </aside>
      </div>
    </div>
  );
}

export default function BookingDetail({
  booking,
  role = ROLES.CLIENT,
  showHeader = true,
  onCancel,
  onRemoveBlock,
}) {
  if (role === ROLES.COMPANY && isBlock(booking)) {
    return <BlockDetail booking={booking} showHeader={showHeader} onRemoveBlock={onRemoveBlock} />;
  }
  if (role === ROLES.COMPANY) {
    return <CompanyDetail booking={booking} showHeader={showHeader} onCancel={onCancel} />;
  }
  if (role === ROLES.ADMIN) return <AdminDetail booking={booking} showHeader={showHeader} />;
  return <ClientDetail booking={booking} showHeader={showHeader} onCancel={onCancel} />;
}
