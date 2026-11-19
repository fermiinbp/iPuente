// Detalle de una empresa: datos, edificios y acciones de aprobar, rechazar o suspender.
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import { usePageTitle } from '@/hooks/usePageTitle.js';

export default function AdminCompanyDetail() {
  usePageTitle('Detalle de la empresa');

  return (
    <PageContainer>
      <h1>Detalle de la empresa</h1>
      <p>Esta pantalla estará disponible pronto.</p>
    </PageContainer>
  );
}
