import { defineConfig } from 'drizzle-kit'

// Reads DATABASE_URL directly rather than importing it from '#env': that
// module pulls in @fohte/service-kit/env, which is ESM-only and breaks
// drizzle-kit's CJS bundling of this config file. `generate` never opens a
// DB connection, so this only matters for `migrate`/`push`, which run
// through mise (see CLAUDE.md), where DATABASE_URL is already set.
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? '',
  },
})
