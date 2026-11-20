// Guarda de ruta por rol (COMPANY o ADMIN): si el usuario no lo tiene, vuelve a la home.
// Sin sesión va a /login. Solo oculta pantallas; la seguridad real está en la API.
import { Navigate, Outlet, useLocation } from 'react-router';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { useAuth } from '@/hooks/useAuth.js';

export default function RoleRoute({ roles }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Comprobando tu sesión…" />;
  if (!user) {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }
  if (!roles.includes(role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
