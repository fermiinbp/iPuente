// Componente raíz: mapa de rutas de la web (públicas, de cliente, de empresa y de admin).
// Las guardas PrivateRoute (sesión) y RoleRoute (rol) envuelven las rutas privadas; la seguridad real está en la API.
import { Route, Routes } from 'react-router';
import DashboardLayout from '@/components/layout/DashboardLayout/DashboardLayout.jsx';
import Layout from '@/components/layout/Layout/Layout.jsx';
import { ROLES } from '@/config/constants.js';
import Account from '@/pages/Account/Account.jsx';
import AdminBookings from '@/pages/admin/AdminBookings/AdminBookings.jsx';
import AdminCompanies from '@/pages/admin/AdminCompanies/AdminCompanies.jsx';
import AdminCompanyDetail from '@/pages/admin/AdminCompanyDetail/AdminCompanyDetail.jsx';
import AdminDashboard from '@/pages/admin/AdminDashboard/AdminDashboard.jsx';
import AdminPayments from '@/pages/admin/AdminPayments/AdminPayments.jsx';
import AdminUsers from '@/pages/admin/AdminUsers/AdminUsers.jsx';
import BookingCheckout from '@/pages/BookingCheckout/BookingCheckout.jsx';
import BookingDetailPage from '@/pages/BookingDetailPage/BookingDetailPage.jsx';
import Building from '@/pages/Building/Building.jsx';
import CompanyBookings from '@/pages/company/CompanyBookings/CompanyBookings.jsx';
import CompanyBuildings from '@/pages/company/CompanyBuildings/CompanyBuildings.jsx';
import CompanyDashboard from '@/pages/company/CompanyDashboard/CompanyDashboard.jsx';
import CompanyRegister from '@/pages/company/CompanyRegister/CompanyRegister.jsx';
import CompanyRequestStatus from '@/pages/company/CompanyRequestStatus/CompanyRequestStatus.jsx';
import CompanyRooms from '@/pages/company/CompanyRooms/CompanyRooms.jsx';
import CompanySettings from '@/pages/company/CompanySettings/CompanySettings.jsx';
import MapEditorPage from '@/pages/company/MapEditorPage/MapEditorPage.jsx';
import Floor from '@/pages/Floor/Floor.jsx';
import ForgotPassword from '@/pages/ForgotPassword/ForgotPassword.jsx';
import Landing from '@/pages/Landing/Landing.jsx';
import Login from '@/pages/Login/Login.jsx';
import MyBookings from '@/pages/MyBookings/MyBookings.jsx';
import NotFound from '@/pages/NotFound/NotFound.jsx';
import PaymentResult from '@/pages/PaymentResult/PaymentResult.jsx';
import Register from '@/pages/Register/Register.jsx';
import ResetPassword from '@/pages/ResetPassword/ResetPassword.jsx';
import Room from '@/pages/Room/Room.jsx';
import Search from '@/pages/Search/Search.jsx';
import PrivateRoute from '@/router/PrivateRoute.jsx';
import RoleRoute from '@/router/RoleRoute.jsx';

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
            <Route path="floors/:floorId/editor" element={<MapEditorPage />} />
            <Route path="rooms" element={<CompanyRooms />} />
            {/* El detalle es un panel lateral sobre la lista (EMP014) */}
            <Route path="bookings" element={<CompanyBookings />} />
            <Route path="bookings/:bookingId" element={<CompanyBookings />} />
            <Route path="settings" element={<CompanySettings />} />
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
  );
}
