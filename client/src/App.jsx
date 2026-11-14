// Componente raíz: mapa de rutas de la web (públicas, de cliente, de empresa y de admin).
// Las guardas PrivateRoute y RoleRoute se añadirán cuando exista el AuthProvider con Firebase.
import { Route, Routes } from 'react-router';
import DashboardLayout from '@/components/layout/DashboardLayout/DashboardLayout.jsx';
import Layout from '@/components/layout/Layout/Layout.jsx';
import AdminBookings from '@/pages/admin/AdminBookings/AdminBookings.jsx';
import AdminCompanies from '@/pages/admin/AdminCompanies/AdminCompanies.jsx';
import AdminDashboard from '@/pages/admin/AdminDashboard/AdminDashboard.jsx';
import AdminPayments from '@/pages/admin/AdminPayments/AdminPayments.jsx';
import AdminUsers from '@/pages/admin/AdminUsers/AdminUsers.jsx';
import Building from '@/pages/Building/Building.jsx';
import CompanyBookings from '@/pages/company/CompanyBookings/CompanyBookings.jsx';
import CompanyBuildings from '@/pages/company/CompanyBuildings/CompanyBuildings.jsx';
import CompanyDashboard from '@/pages/company/CompanyDashboard/CompanyDashboard.jsx';
import CompanyRegister from '@/pages/company/CompanyRegister/CompanyRegister.jsx';
import CompanyRooms from '@/pages/company/CompanyRooms/CompanyRooms.jsx';
import MapEditorPage from '@/pages/company/MapEditorPage/MapEditorPage.jsx';
import Floor from '@/pages/Floor/Floor.jsx';
import Landing from '@/pages/Landing/Landing.jsx';
import Login from '@/pages/Login/Login.jsx';
import MyBookings from '@/pages/MyBookings/MyBookings.jsx';
import NotFound from '@/pages/NotFound/NotFound.jsx';
import PaymentResult from '@/pages/PaymentResult/PaymentResult.jsx';
import Register from '@/pages/Register/Register.jsx';
import Room from '@/pages/Room/Room.jsx';

const COMPANY_LINKS = [
  { to: '/company', label: 'Resumen', end: true },
  { to: '/company/buildings', label: 'Edificios' },
  { to: '/company/rooms', label: 'Salas' },
  { to: '/company/bookings', label: 'Reservas' },
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
      <Route element={<Layout />}>
        {/* Públicas */}
        <Route index element={<Landing />} />
        <Route path="buildings/:buildingId" element={<Building />} />
        <Route path="buildings/:buildingId/floors/:floorId" element={<Floor />} />
        <Route path="rooms/:roomId" element={<Room />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />

        {/* Cliente */}
        <Route path="my-bookings" element={<MyBookings />} />
        <Route path="payment/result" element={<PaymentResult />} />

        {/* Empresa */}
        <Route
          path="company"
          element={<DashboardLayout title="Panel de empresa" links={COMPANY_LINKS} />}
        >
          <Route index element={<CompanyDashboard />} />
          <Route path="register" element={<CompanyRegister />} />
          <Route path="buildings" element={<CompanyBuildings />} />
          <Route path="floors/:floorId/editor" element={<MapEditorPage />} />
          <Route path="rooms" element={<CompanyRooms />} />
          <Route path="bookings" element={<CompanyBookings />} />
        </Route>

        {/* Admin */}
        <Route
          path="admin"
          element={<DashboardLayout title="Panel de administración" links={ADMIN_LINKS} />}
        >
          <Route index element={<AdminDashboard />} />
          <Route path="companies" element={<AdminCompanies />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="payments" element={<AdminPayments />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
