// Panel lateral que se abre al pulsar una sala del plano: estado, capacidad, precio y acceso a su ficha.
// Una sala que no se alquila se muestra, pero no se puede reservar.
import Button from '@/components/ui/Button/Button.jsx';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge.jsx';
import { formatPrice } from '@/utils/formatPrice.js';
import styles from './RoomSidePanel.module.css';

export default function RoomSidePanel({ room, fecha, people = '', onClose }) {
  if (!room) {
    return (
      <div className={styles.panel} aria-live="polite">
        <p className={styles.hint}>
          Pulsa una sala en el plano o en la lista para ver su precio, su capacidad y reservarla.
        </p>
      </div>
    );
  }

  const params = new URLSearchParams();
  if (fecha) params.set('date', fecha);
  if (people) params.set('people', people);
  const query = params.toString() ? `?${params.toString()}` : '';
  const rentable = room.status !== 'off';

  return (
    <div className={styles.panel} aria-live="polite">
      <div className={styles.head}>
        <h3 className={styles.name}>{room.name}</h3>
        <StatusBadge status={room.status} />
      </div>

      {rentable ? (
        <dl className={styles.data}>
          <div>
            <dt>Capacidad</dt>
            <dd>{room.people ? `${room.people} personas` : '—'}</dd>
          </div>
          <div>
            <dt>Precio</dt>
            <dd>{room.price != null ? `${formatPrice(room.price)} / hora` : '—'}</dd>
          </div>
        </dl>
      ) : (
        <p className={styles.hint}>Esta sala aparece en el plano, pero no se alquila.</p>
      )}

      {room.status === 'occupied' && (
        <p className={styles.hint}>Está ocupada en este día. Mira sus huecos libres en la ficha.</p>
      )}

      <div className={styles.actions}>
        {rentable && (
          <Button to={`/rooms/${room.id}${query}`}>
            {room.status === 'free' ? 'Ver sala y reservar' : 'Ver huecos libres'}
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          Quitar selección
        </Button>
      </div>
    </div>
  );
}
