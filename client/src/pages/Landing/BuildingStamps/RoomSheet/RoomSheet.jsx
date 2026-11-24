// Ficha de una sala al pulsar su estampa: hoja desde abajo en móvil y panel centrado desde 900 px (BottomSheet).
// Dice el estado con texto (StatusBadge) y lleva a la ficha completa para reservar. Una sala que no se alquila se
// explica en lugar de ofrecer reserva. El foco vuelve a la estampa al cerrar (lo hace BottomSheet).
import { Link } from 'react-router';
import BottomSheet from '@/components/ui/BottomSheet/BottomSheet.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge.jsx';
import { formatPrice } from '@/utils/formatPrice.js';
import styles from './RoomSheet.module.css';

export default function RoomSheet({ stamp, buildingId, onClose }) {
  const rentable = stamp.status !== 'off';
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={stamp.name}
      footer={
        rentable ? (
          <Button to={`/rooms/${stamp.id}`}>
            {stamp.status === 'free' ? 'Ver sala y reservar' : 'Ver huecos libres'}
          </Button>
        ) : null
      }
    >
      <div className={styles.cuerpo}>
        <p className={styles.estado}>
          <StatusBadge status={stamp.status} /> {stamp.floorName}
        </p>
        {rentable ? (
          <dl className={styles.datos}>
            <div>
              <dt>Capacidad</dt>
              <dd>{stamp.people} personas</dd>
            </div>
            <div>
              <dt>Precio</dt>
              <dd>{formatPrice(stamp.price)} / hora</dd>
            </div>
          </dl>
        ) : (
          <p className={styles.nota}>Esta sala aparece en el plano, pero no se alquila.</p>
        )}
        {stamp.status === 'occupied' && (
          <p className={styles.nota}>
            Está ocupada hoy. Mira sus huecos libres en la ficha de la sala.
          </p>
        )}
        <Link className={styles.enlace} to={`/buildings/${buildingId}/floors/${stamp.floorId}`}>
          Ver el plano de la {stamp.floorName.toLowerCase()}
        </Link>
      </div>
    </BottomSheet>
  );
}
