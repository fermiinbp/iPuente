// Vuelta desde Stripe: reserva confirmada o pago cancelado (`?status=success` o `?status=cancelled`).
// Todavía no hay pago online: las reservas nacen confirmadas. Esta pantalla queda lista para cuando lo haya.
import { useSearchParams } from 'react-router';
import Button from '@/components/ui/Button/Button.jsx';
import EmptyState from '@/components/ui/EmptyState/EmptyState.jsx';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import styles from './PaymentResult.module.css';

const RESULTS = {
  success: {
    title: 'Reserva confirmada',
    text: 'Hemos recibido tu pago y tu sala está reservada. Puedes ver los detalles en «Mis reservas».',
  },
  cancelled: {
    title: 'Pago cancelado',
    text: 'No se ha hecho ningún cargo. Tu reserva sigue pendiente unos minutos: puedes volver a intentarlo desde «Mis reservas».',
  },
};

export default function PaymentResult() {
  usePageTitle('Resultado del pago');
  const [params] = useSearchParams();
  const result = RESULTS[params.get('status')];

  return (
    <div className={styles.page}>
      <EmptyState
        title={result?.title ?? 'No hay nada que mostrar'}
        action={<Button to="/my-bookings">Ir a mis reservas</Button>}
      >
        {result?.text ?? 'Entra en «Mis reservas» para ver el estado de tus reservas.'}
      </EmptyState>
    </div>
  );
}
