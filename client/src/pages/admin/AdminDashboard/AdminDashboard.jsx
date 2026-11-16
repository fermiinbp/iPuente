// Resumen del panel de admin.
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import { usePageTitle } from '@/hooks/usePageTitle.js';

export default function AdminDashboard() {
  usePageTitle('Panel de administración');

  return (
    <PageContainer>
      <h1>Panel de administración</h1>
      <p>Esta pantalla estará disponible pronto.</p>
    </PageContainer>
  );
}
