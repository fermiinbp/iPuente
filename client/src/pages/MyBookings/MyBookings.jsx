// Reservas del cliente: próximas y pasadas, con cancelación.
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import { usePageTitle } from '@/hooks/usePageTitle.js';

export default function MyBookings() {
  usePageTitle('Mis reservas');

  return (
    <PageContainer>
      <h1>Mis reservas</h1>
      <p>Esta pantalla estará disponible pronto.</p>
    </PageContainer>
  );
}
