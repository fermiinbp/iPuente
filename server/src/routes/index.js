// Une todas las rutas bajo /api (excepto el webhook y la documentación, que se montan en app.js).
import { Router } from 'express';

import authRoutes from './auth.routes.js';
import bookingsRoutes from './bookings.routes.js';
import buildingsRoutes from './buildings.routes.js';
import companyRoutes from './company.routes.js';
import floorsRoutes from './floors.routes.js';
import healthRoutes from './health.routes.js';
import mapsRoutes from './maps.routes.js';
import roomsRoutes from './rooms.routes.js';
import usersRoutes from './users.routes.js';

const router = Router();

router.use(healthRoutes);
router.use(authRoutes);
router.use(bookingsRoutes);
router.use(buildingsRoutes);
router.use(companyRoutes);
router.use(floorsRoutes);
router.use(mapsRoutes);
router.use(roomsRoutes);
router.use(usersRoutes);

export default router;
