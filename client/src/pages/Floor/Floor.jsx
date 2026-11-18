// Página de una planta: plano, selector de fecha y panel de sala.
import { useParams } from 'react-router';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import { usePageTitle } from '@/hooks/usePageTitle.js';

export default function Floor() {
  const { floorId } = useParams();
  usePageTitle('Planta');

  return (
    <PageContainer>
      <h1>Planta</h1>
      <p>Esta pantalla estará disponible pronto.</p>
      <p>
        <small>Referencia de la planta: {floorId}</small>
      </p>
    </PageContainer>
  );
}
