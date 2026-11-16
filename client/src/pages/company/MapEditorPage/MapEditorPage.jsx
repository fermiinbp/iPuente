// Página del editor de mapas de una planta: subir plano, detectar, corregir, guardar y publicar.
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import { usePageTitle } from '@/hooks/usePageTitle.js';

export default function MapEditorPage() {
  usePageTitle('Editor de mapas');

  return (
    <PageContainer>
      <h1>Editor de mapas</h1>
      <p>Esta pantalla estará disponible pronto.</p>
    </PageContainer>
  );
}
