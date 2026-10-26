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
import prisma from './shared/database/prisma';
import redis from './shared/redis/redis';

const app = express();

// CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
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

// Mount REST API endpoints
app.use('/api/auth', authRoutes);
app.use('/api/farmers', farmersRoutes);
app.use('/api/weighing', weighingRoutes);
app.use('/api/sorting', sortingRoutes);
app.use('/api/pallets', palletsRoutes);
app.use('/api/packaging', packagingRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/deliveries', deliveriesRoutes);
app.use('/api/traceability', traceabilityRoutes);

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
