// Documentación de la API con Swagger: genera la especificación OpenAPI leyendo los comentarios @openapi de las rutas y la sirve en /api/docs.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

// Carpeta de las rutas. Desde este archivo funciona en local, en los tests y en Vercel (función ESM);
// si import.meta.url no apuntara aquí, se usa la copia que añade includeFiles (vercel.json) desde la raíz.
const sourceRoutesDir = import.meta.url
  ? fileURLToPath(new URL('../routes', import.meta.url))
  : null;
const routesDir =
  sourceRoutesDir && existsSync(sourceRoutesDir)
    ? sourceRoutesDir
    : path.join(process.cwd(), 'server/src/routes');
const routesGlob = path.join(routesDir, '*.js').replace(/\\/g, '/');

const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'iPuente API',
    version: '0.1.0',
    description:
      'API de iPuente: edificios, plantas y salas publicadas por las empresas, reservas y pagos de los clientes y panel de administración.',
  },
  servers: [{ url: '/api' }],
  tags: [
    { name: 'Público', description: 'Endpoints abiertos, sin sesión.' },
    { name: 'Auth', description: 'Registro de clientes y empresas.' },
    { name: 'Cliente', description: 'Reservas y perfil del cliente autenticado.' },
    { name: 'Empresa', description: 'Panel de empresa: edificios, plantas, salas y reservas.' },
    { name: 'Mapas', description: 'Detección con IA, guardado y publicación de mapas de planta.' },
    { name: 'Pagos', description: 'Checkout de Stripe y webhook.' },
    { name: 'Admin', description: 'Panel de administración.' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'ID token de Firebase Auth (`user.getIdToken()`).',
      },
    },
    schemas: {
      MyBooking: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          roomId: { type: 'string' },
          sala: {
            type: 'object',
            nullable: true,
            properties: { nombre: { type: 'string' }, codigo: { type: 'string' } },
          },
          fecha: { type: 'string', format: 'date' },
          inicio: { type: 'integer' },
          fin: { type: 'integer' },
          horas: { type: 'integer' },
          precioHora: { type: 'number' },
          importe: { type: 'number' },
          estado: { type: 'string', example: 'CONFIRMED' },
        },
      },
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'NOT_FOUND' },
              message: { type: 'string', example: 'No existe la ruta GET /api/no-existe' },
              details: { description: 'Detalle opcional, p. ej. errores de validación por campo.' },
            },
          },
        },
      },
    },
    responses: {
      BadRequest: errorResponse('Petición no válida (VALIDATION_ERROR, INVALID_JSON…).'),
      Unauthorized: errorResponse('Falta el token o no es válido.'),
      Forbidden: errorResponse('El usuario no tiene permiso para este recurso.'),
      NotFound: errorResponse('El recurso no existe.'),
      TooManyRequests: errorResponse('Demasiadas peticiones (RATE_LIMITED). Espera y reintenta.'),
    },
  },
};

export const swaggerSpec = swaggerJsdoc({ definition, apis: [routesGlob] });

export const swaggerServe = swaggerUi.serve;
export const swaggerSetup = swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'iPuente API',
  // El token guardado en el navegador solo se recuerda fuera de producción.
  swaggerOptions: { persistAuthorization: process.env.NODE_ENV !== 'production' },
});
