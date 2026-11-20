// Estado de la solicitud de alta: en revisión o rechazada con su motivo.
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import { usePageTitle } from '@/hooks/usePageTitle.js';

export default function CompanyRequestStatus() {
  usePageTitle('Estado de tu solicitud');

  return (
    <PageContainer>
      <h1>Estado de tu solicitud</h1>
      <p>Esta pantalla estará disponible pronto.</p>
    </PageContainer>
  );
}
