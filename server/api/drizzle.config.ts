import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/drizzle/schema.ts',
  out: './src/database/drizzle/migrations',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgres://injishi:injishi@localhost:5432/injishi',
  },
});
