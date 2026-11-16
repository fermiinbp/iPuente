// Vuelta desde Stripe: reserva confirmada o pago cancelado.
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import { usePageTitle } from '@/hooks/usePageTitle.js';

export default function PaymentResult() {
  usePageTitle('Resultado del pago');

  return (
    <PageContainer>
      <h1>Resultado del pago</h1>
      <p>Esta pantalla estará disponible pronto.</p>
    </PageContainer>
  );
}
