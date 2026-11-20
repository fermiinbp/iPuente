// Página 404: rutas que no existen. El foco va al título al entrar.
import { useEffect, useRef } from 'react';
import Button from '@/components/ui/Button/Button.jsx';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import { usePageTitle } from '@/hooks/usePageTitle.js';

export default function NotFound() {
  usePageTitle('Página no encontrada');
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <PageContainer>
      <h1 ref={headingRef} tabIndex={-1}>
        Esta página no existe
      </h1>
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
