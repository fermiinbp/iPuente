// Página 404.
import Button from '@/components/ui/Button/Button.jsx';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import { usePageTitle } from '@/hooks/usePageTitle.js';

export default function NotFound() {
  usePageTitle('Página no encontrada');

  return (
    <PageContainer>
      <h1>Esta página no existe</h1>
      <p>
        La dirección que has escrito no es correcta o la página ya no está. Vuelve al inicio para
        seguir explorando.
      </p>
      <Button to="/" variant="secondary">
        Volver al inicio
      </Button>
    </PageContainer>
  );
}
