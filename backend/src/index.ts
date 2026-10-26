import express from 'express';
import { config } from './config/env';
import { setupSwagger } from './config/swagger';
import { errorHandler } from './middlewares/errorHandler';

// API route imports
import authRoutes from './modules/auth.routes';
import farmersRoutes from './modules/farmers.routes';
import palletsRoutes from './modules/pallets.routes';
import weighingRoutes from './modules/weighing.routes';
import sortingRoutes from './modules/sorting.routes';
import packagingRoutes from './modules/packaging.routes';
import warehouseRoutes from './modules/warehouse.routes';
import deliveriesRoutes from './modules/deliveries.routes';
import traceabilityRoutes from './modules/traceability.routes';
import scalesRoutes from './modules/scales.routes';
import labelsRoutes from './modules/labels.routes';
import prisma from './shared/database/prisma';
import redis from './shared/redis/redis';

const app = express();
app.disable('x-powered-by');

// Security & CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'SAMEORIGIN');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', async (req, res) => {
  let dbStatus = 'disconnected';
  let redisStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'error';
  }
  try {
    await redis.ping();
    redisStatus = 'connected';
  } catch {
    redisStatus = 'error';
  }

  res.json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    system: 'ENYX-Smart Hub API',
    database: dbStatus,
    redis: redisStatus,
    timestamp: new Date().toISOString(),
  });
});

// Swagger docs
if (config.env !== 'production') {
  setupSwagger(app);
}

// Mount REST API endpoints (v1)
const apiV1Router = express.Router();
apiV1Router.use('/auth', authRoutes);
apiV1Router.use('/farmers', farmersRoutes);
apiV1Router.use('/weighing', weighingRoutes);
apiV1Router.use('/sorting', sortingRoutes);
apiV1Router.use('/pallets', palletsRoutes);
apiV1Router.use('/packaging', packagingRoutes);
apiV1Router.use('/warehouse', warehouseRoutes);
apiV1Router.use('/deliveries', deliveriesRoutes);
apiV1Router.use('/traceability', traceabilityRoutes);
apiV1Router.use('/scales', scalesRoutes);
apiV1Router.use('/labels', labelsRoutes);
apiV1Router.get('/health', async (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Canonical versioned route
app.use('/api/v1', apiV1Router);
// Backward compatibility alias
app.use('/api', apiV1Router);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.originalUrl} not found`,
    },
  });
});

// Error handler
app.use(errorHandler);

if (require.main === module) {
  const PORT = config.port || 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  app.listen(PORT, HOST, () => {
    console.log(`🚀 ENYX-Smart Hub API running on http://${HOST}:${PORT}`);
    console.log(`📚 Swagger docs: http://${HOST}:${PORT}/api/docs`);
    console.log(`🏥 Health check: http://${HOST}:${PORT}/health`);
  });
}

export default app;
