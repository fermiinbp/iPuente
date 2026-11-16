// Aprobar o suspender empresas.
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import { usePageTitle } from '@/hooks/usePageTitle.js';

export default function AdminCompanies() {
  usePageTitle('Empresas');

  return (
    <PageContainer>
      <h1>Empresas</h1>
      <p>Esta pantalla estará disponible pronto.</p>
    </PageContainer>
  );
}
