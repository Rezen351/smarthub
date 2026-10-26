import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  // Direct connection for Prisma CLI tools (migrate, db push)
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
