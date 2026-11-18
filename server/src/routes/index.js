// Une todas las rutas bajo /api (excepto el webhook y la documentación, que se montan en app.js).
import { Router } from 'express';

import healthRoutes from './health.routes.js';

const router = Router();

router.use(healthRoutes);

export default router;
