// Guarda de ruta: si no hay sesión, redirige a /login. Solo oculta pantallas; la seguridad real está en la API.
// Se usa como ruta de diseño: las rutas hijas se pintan en <Outlet />. Guarda la página pedida en `state.from`.
import { Navigate, Outlet, useLocation } from 'react-router';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { useAuth } from '@/hooks/useAuth.js';

export default function PrivateRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <PageContainer>
        <Spinner />
      </PageContainer>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
