// Guarda de ruta según el estado de la empresa, dentro de `<RoleRoute role={ROLES.COMPANY} />`. Solo mira el claim
// `companyApproved` del token (AuthProvider): sin aprobar (pendiente, rechazada o suspendida), cualquier /company/*
// lleva a /company/request; aprobada, /company/request lleva a /company. Qué estado concreto se muestra lo decide
// CompanyRequestStatus con GET /companies/me. Solo oculta pantallas; la seguridad real está en la API
// (requireApprovedCompany).
import { Navigate, Outlet, useLocation } from 'react-router';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { useAuth } from '@/hooks/useAuth.js';

const REQUEST_PATH = '/company/request';

export default function CompanyStatusRoute() {
  const { companyApproved, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) {
    return (
      <PageContainer>
        <Spinner />
      </PageContainer>
    );
  }

  const onRequestPage = pathname.replace(/\/+$/, '') === REQUEST_PATH;

  if (!companyApproved && !onRequestPage) {
    return <Navigate to={REQUEST_PATH} replace />;
  }

  if (companyApproved && onRequestPage) {
    return <Navigate to="/company" replace />;
  }

  return <Outlet />;
}
