// Recuperar contraseña: pide el email y envía el enlace.
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import { usePageTitle } from '@/hooks/usePageTitle.js';

export default function ForgotPassword() {
  usePageTitle('Recuperar contraseña');

  return (
    <PageContainer>
      <h1>Recuperar contraseña</h1>
      <p>Esta pantalla estará disponible pronto.</p>
    </PageContainer>
  );
}
