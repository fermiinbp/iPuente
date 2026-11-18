// Datos comerciales de las salas: precio, capacidad, equipamiento y fotos.
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import { usePageTitle } from '@/hooks/usePageTitle.js';

export default function CompanyRooms() {
  usePageTitle('Salas');

  return (
    <PageContainer>
      <h1>Salas</h1>
      <p>Esta pantalla estará disponible pronto.</p>
    </PageContainer>
  );
}
