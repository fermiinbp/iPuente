// Recuperar contraseña: formulario de nueva contraseña desde el enlace.
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import { usePageTitle } from '@/hooks/usePageTitle.js';

export default function ResetPassword() {
  usePageTitle('Nueva contraseña');

  return (
    <PageContainer>
      <h1>Nueva contraseña</h1>
      <p>Esta pantalla estará disponible pronto.</p>
    </PageContainer>
  );
}
