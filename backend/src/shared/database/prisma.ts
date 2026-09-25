import { PrismaClient } from '@prisma/client';
import { config } from '../../config/env';

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
  datasources: {
    db: {
      url: config.database.url,
    },
  },
});

export default prisma;
