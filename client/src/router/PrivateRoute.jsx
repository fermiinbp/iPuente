// Guarda de ruta: si no hay sesión, redirige a /login. Solo oculta pantallas; la seguridad real está en la API.
import { Navigate, Outlet, useLocation } from 'react-router';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { useAuth } from '@/hooks/useAuth.js';

export default function PrivateRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Comprobando tu sesión…" />;
  if (!user) {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }
  return <Outlet />;
}
