// Guarda de ruta por rol (COMPANY o ADMIN): si el usuario no lo tiene, vuelve a la home.
// Solo oculta pantallas; la seguridad real está en la API. Se usa como ruta de diseño: `<RoleRoute role={ROLES.ADMIN} />`.
import { Navigate, Outlet } from 'react-router';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { useAuth } from '@/hooks/useAuth.js';

export default function RoleRoute({ role }) {
  const { role: userRole, loading } = useAuth();

  if (loading) {
    return (
      <PageContainer>
        <Spinner />
      </PageContainer>
    );
  }

  if (userRole !== role) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
