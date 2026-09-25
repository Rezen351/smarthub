import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  // Direct connection for Prisma CLI tools (migrate, db push)
  database: {
    url: process.env.DATABASE_URL,
  },
});
