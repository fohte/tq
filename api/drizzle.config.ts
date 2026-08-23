import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Read directly rather than importing from '#env': that module pulls in
    // @fohte/service-kit/env, which is ESM-only and breaks drizzle-kit's CJS
    // bundling of this config file. `generate` never opens a DB connection,
    // so this only matters for `migrate`/`push`, which run through mise
    // (which sets DATABASE_URL before invoking drizzle-kit).
    url: process.env['DATABASE_URL'] ?? '',
  },
})
