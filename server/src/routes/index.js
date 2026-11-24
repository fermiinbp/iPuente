// Une todas las rutas bajo /api (excepto el webhook y la documentación, que se montan en app.js).
import { Router } from 'express';

import adminRoutes from './admin.routes.js';
import authRoutes from './auth.routes.js';
import bookingsRoutes from './bookings.routes.js';
import buildingsRoutes from './buildings.routes.js';
import companyBookingsRoutes from './companyBookings.routes.js';
import companyRoutes from './company.routes.js';
import floorsRoutes from './floors.routes.js';
import healthRoutes from './health.routes.js';
import mapsRoutes from './maps.routes.js';
import paymentsRoutes from './payments.routes.js';
import payoutsRoutes from './payouts.routes.js';
import roomsRoutes from './rooms.routes.js';
import usersRoutes from './users.routes.js';

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
