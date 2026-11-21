// Componente raíz: mapa de rutas de la web (públicas, de cliente, de empresa y de admin).
// Las guardas PrivateRoute (sesión) y RoleRoute (rol) envuelven las rutas privadas; la seguridad real está en la API.
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import DashboardLayout from '@/components/layout/DashboardLayout/DashboardLayout.jsx';
import Layout from '@/components/layout/Layout/Layout.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { ROLES } from '@/config/constants.js';
import Landing from '@/pages/Landing/Landing.jsx';
import NotFound from '@/pages/NotFound/NotFound.jsx';
import CompanyStatusRoute from '@/router/CompanyStatusRoute.jsx';
import PrivateRoute from '@/router/PrivateRoute.jsx';
import RoleRoute from '@/router/RoleRoute.jsx';

// Cada pantalla se descarga solo al visitarla (la Landing y el 404 van en el paquete principal).
const Account = lazy(() => import('@/pages/Account/Account.jsx'));
const AdminBookings = lazy(() => import('@/pages/admin/AdminBookings/AdminBookings.jsx'));
const AdminCompanies = lazy(() => import('@/pages/admin/AdminCompanies/AdminCompanies.jsx'));
const AdminCompanyDetail = lazy(
  () => import('@/pages/admin/AdminCompanyDetail/AdminCompanyDetail.jsx'),
);
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard/AdminDashboard.jsx'));
const AdminPayments = lazy(() => import('@/pages/admin/AdminPayments/AdminPayments.jsx'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers/AdminUsers.jsx'));
const BookingCheckout = lazy(() => import('@/pages/BookingCheckout/BookingCheckout.jsx'));
const BookingDetailPage = lazy(() => import('@/pages/BookingDetailPage/BookingDetailPage.jsx'));
const Building = lazy(() => import('@/pages/Building/Building.jsx'));
const BuildingForm = lazy(() => import('@/pages/company/BuildingForm/BuildingForm.jsx'));
const CompanyBookings = lazy(() => import('@/pages/company/CompanyBookings/CompanyBookings.jsx'));
const CompanyBuildings = lazy(
  () => import('@/pages/company/CompanyBuildings/CompanyBuildings.jsx'),
);
const CompanyDashboard = lazy(
  () => import('@/pages/company/CompanyDashboard/CompanyDashboard.jsx'),
);
const CompanyRegister = lazy(() => import('@/pages/company/CompanyRegister/CompanyRegister.jsx'));
const CompanyRequestStatus = lazy(
  () => import('@/pages/company/CompanyRequestStatus/CompanyRequestStatus.jsx'),
);
const CompanyRooms = lazy(() => import('@/pages/company/CompanyRooms/CompanyRooms.jsx'));
const CompanySettings = lazy(() => import('@/pages/company/CompanySettings/CompanySettings.jsx'));
const MapEditorPage = lazy(() => import('@/pages/company/MapEditorPage/MapEditorPage.jsx'));
const Floor = lazy(() => import('@/pages/Floor/Floor.jsx'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword/ForgotPassword.jsx'));
const Login = lazy(() => import('@/pages/Login/Login.jsx'));
const MyBookings = lazy(() => import('@/pages/MyBookings/MyBookings.jsx'));
const PaymentResult = lazy(() => import('@/pages/PaymentResult/PaymentResult.jsx'));
const Register = lazy(() => import('@/pages/Register/Register.jsx'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword/ResetPassword.jsx'));
const Room = lazy(() => import('@/pages/Room/Room.jsx'));
const Search = lazy(() => import('@/pages/Search/Search.jsx'));

const COMPANY_LINKS = [
  { to: '/company', label: 'Resumen', end: true },
  { to: '/company/buildings', label: 'Mis edificios' },
  { to: '/company/rooms', label: 'Salas' },
  { to: '/company/bookings', label: 'Reservas' },
  { to: '/company/settings', label: 'Ajustes' },
];

const ADMIN_LINKS = [
  { to: '/admin', label: 'Resumen', end: true },
  { to: '/admin/companies', label: 'Empresas' },
  { to: '/admin/users', label: 'Usuarios' },
  { to: '/admin/bookings', label: 'Reservas' },
  { to: '/admin/payments', label: 'Pagos' },
];

export default function App() {
  return (
    <Suspense fallback={<Spinner label="Cargando…" />}>
      <Routes>
        {/* Acceso: sin cabecera ni pie (AuthLayout dentro de cada pantalla) */}
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />

        <Route element={<Layout />}>
          {/* Públicas */}
          <Route index element={<Landing />} />
          <Route path="search" element={<Search />} />
          <Route path="buildings/:buildingId" element={<Building />} />
          <Route path="buildings/:buildingId/floors/:floorId" element={<Floor />} />
          <Route path="rooms/:roomId" element={<Room />} />

          {/* Alta de empresa: sin sesión, porque crea una cuenta de empresa nueva (EMP001) */}
          <Route path="company/register" element={<CompanyRegister />} />

          {/* Con sesión */}
          <Route element={<PrivateRoute />}>
            <Route path="my-bookings" element={<MyBookings />} />
            <Route path="my-bookings/:bookingId" element={<BookingDetailPage />} />
            <Route path="checkout/:bookingId" element={<BookingCheckout />} />
            <Route path="payment/result" element={<PaymentResult />} />
            <Route path="account" element={<Account />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Paneles: con su propia cabecera (DashboardLayout), sin la cabecera ni el pie públicos */}
        <Route element={<PrivateRoute />}>
          <Route element={<RoleRoute role={ROLES.COMPANY} />}>
            {/* Sin aprobar, todo /company/* lleva al estado de la solicitud; aprobada, la solicitud lleva al panel */}
            <Route element={<CompanyStatusRoute />}>
              {/* Estado de la solicitud de alta: cabecera del panel sin menú lateral (wireframe 10b) */}
              <Route element={<DashboardLayout title="Panel de empresa" />}>
                <Route path="company/request" element={<CompanyRequestStatus />} />
              </Route>

              <Route
                path="company"
                element={<DashboardLayout title="Panel de empresa" links={COMPANY_LINKS} />}
              >
                <Route index element={<CompanyDashboard />} />
                <Route path="buildings" element={<CompanyBuildings />} />
                {/* Crear y editar usan la misma página (EMP004) */}
                <Route path="buildings/new" element={<BuildingForm />} />
                <Route path="buildings/:buildingId/edit" element={<BuildingForm />} />
                <Route path="floors/:floorId/editor" element={<MapEditorPage />} />
                <Route path="rooms" element={<CompanyRooms />} />
                {/* El detalle es un panel lateral sobre la lista (EMP014) */}
                <Route path="bookings" element={<CompanyBookings />} />
                <Route path="bookings/:bookingId" element={<CompanyBookings />} />
                <Route path="settings" element={<CompanySettings />} />
              </Route>
            </Route>
          </Route>

          <Route element={<RoleRoute role={ROLES.ADMIN} />}>
            <Route
              path="admin"
              element={<DashboardLayout title="Panel de administración" links={ADMIN_LINKS} />}
            >
              <Route index element={<AdminDashboard />} />
              <Route path="companies" element={<AdminCompanies />} />
              <Route path="companies/:companyId" element={<AdminCompanyDetail />} />
              <Route path="users" element={<AdminUsers />} />
              {/* El detalle es un panel lateral sobre la lista (ADM005) */}
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="bookings/:bookingId" element={<AdminBookings />} />
              <Route path="payments" element={<AdminPayments />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
