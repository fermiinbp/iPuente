// Ficha de sala con galería, equipamiento, disponibilidad y reserva.
import { useParams } from 'react-router';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import { usePageTitle } from '@/hooks/usePageTitle.js';

export default function Room() {
  const { roomId } = useParams();
  usePageTitle('Sala');

  return (
    <PageContainer>
      <h1>Sala</h1>
      <p>Esta pantalla estará disponible pronto.</p>
      <p>
        <small>Referencia de la sala: {roomId}</small>
      </p>
    </PageContainer>
  );
}
