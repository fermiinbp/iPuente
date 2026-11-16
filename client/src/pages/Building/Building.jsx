// Página de un edificio: plantas, salas libres y «Qué hay cerca».
import { useParams } from 'react-router';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import { usePageTitle } from '@/hooks/usePageTitle.js';

export default function Building() {
  const { buildingId } = useParams();
  usePageTitle('Edificio');

  return (
    <PageContainer>
      <h1>Edificio</h1>
      <p>Esta pantalla estará disponible pronto.</p>
      <p>
        <small>Referencia del edificio: {buildingId}</small>
      </p>
    </PageContainer>
  );
}
