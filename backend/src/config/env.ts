import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  
  database: {
    url: process.env.DATABASE_URL || '',
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://:redis123@localhost:6379',
  },

  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  scales: {
    station01: {
      id: '01',
      name: 'Station 01 Reception Floor Scale',
      capacityKg: 150,
      host: process.env.SCALE_STATION_01_HOST || '192.168.1.100',
      port: parseInt(process.env.SCALE_STATION_01_PORT || '502', 10),
    },
    station02: {
      id: '02',
      name: 'Station 02 Sorting Floor Scale',
      capacityKg: 100,
      host: process.env.SCALE_STATION_02_HOST || '192.168.1.101',
      port: parseInt(process.env.SCALE_STATION_02_PORT || '502', 10),
    },
    station03: {
      id: '03',
      name: 'Station 03 Packaging Bench Scale',
      capacityKg: 30,
      host: process.env.SCALE_STATION_03_HOST || '192.168.1.102',
      port: parseInt(process.env.SCALE_STATION_03_PORT || '502', 10),
    },
  },
};

export const isDevelopment = config.env === 'development';
export const isProduction = config.env === 'production';
