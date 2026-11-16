// Resumen del panel de empresa.
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import { usePageTitle } from '@/hooks/usePageTitle.js';

export default function CompanyDashboard() {
  usePageTitle('Panel de empresa');

  return (
    <PageContainer>
      <h1>Panel de empresa</h1>
      <p>Esta pantalla estará disponible pronto.</p>
    </PageContainer>
  );
}
