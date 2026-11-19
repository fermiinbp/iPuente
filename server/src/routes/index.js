// Une todas las rutas bajo /api (excepto el webhook y la documentación, que se montan en app.js).
import { Router } from 'express';

import buildingsRoutes from './buildings.routes.js';
import floorsRoutes from './floors.routes.js';
import healthRoutes from './health.routes.js';
import roomsRoutes from './rooms.routes.js';
import usersRoutes from './users.routes.js';

const router = Router();

router.use(healthRoutes);
router.use(buildingsRoutes);
router.use(floorsRoutes);
router.use(roomsRoutes);
router.use(usersRoutes);

export default router;
