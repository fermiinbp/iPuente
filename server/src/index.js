// Une todas las rutas bajo /api (excepto el webhook y la documentación, que se montan en app.js).
import { Router } from 'express';

import adminRoutes from './routes/admin.routes.js';
import authRoutes from './routes/auth.routes.js';
import bookingsRoutes from './routes/bookings.routes.js';
import buildingsRoutes from './routes/buildings.routes.js';
import companyBookingsRoutes from './routes/companyBookings.routes.js';
import companyRoutes from './routes/company.routes.js';
import floorsRoutes from './routes/floors.routes.js';
import healthRoutes from './routes/health.routes.js';
import mapsRoutes from './routes/maps.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import payoutsRoutes from './routes/payouts.routes.js';
import roomsRoutes from './routes/rooms.routes.js';
import usersRoutes from './routes/users.routes.js';

const router = Router();

router.use(healthRoutes);
router.use(adminRoutes);
router.use(authRoutes);
router.use(bookingsRoutes);
router.use(buildingsRoutes);
router.use(companyBookingsRoutes);
router.use(companyRoutes);
router.use(floorsRoutes);
router.use(mapsRoutes);
router.use(paymentsRoutes);
router.use(payoutsRoutes);
router.use(roomsRoutes);
router.use(usersRoutes);

export default router;
