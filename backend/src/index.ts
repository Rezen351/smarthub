import express from 'express';
import { config } from './config/env';
import { setupSwagger } from './config/swagger';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Swagger docs
if (config.env !== 'production') {
  setupSwagger(app);
}

// API routes
import authRoutes from './modules/auth.routes';
import farmersRoutes from './modules/farmers.routes';
import palletsRoutes from './modules/pallets.routes';
import weighingRoutes from './modules/weighing.routes';
import warehouseRoutes from './modules/warehouse.routes';
import labelsRoutes from './modules/labels.routes';
import packagingRoutes from './modules/packaging.routes';
import deliveriesRoutes from './modules/deliveries.routes';

app.use('/api/auth', authRoutes);
app.use('/api/farmers', farmersRoutes);
app.use('/api/pallets', palletsRoutes);
app.use('/api/weighing', weighingRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/labels', labelsRoutes);
app.use('/api/packaging', packagingRoutes);
app.use('/api/deliveries', deliveriesRoutes);

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

// Start server only when run directly (not when imported)
if (require.main === module) {
  const PORT = config.port || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 ENYX-Smart Hub API running on port ${PORT}`);
    console.log(`📚 Swagger docs: http://localhost:${PORT}/api/docs`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`🌍 Environment: ${config.env}`);
  });
}

export default app;
