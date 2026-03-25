import { defineConfig } from 'drizzle-kit'

// eslint-disable-next-line no-restricted-imports -- drizzle-kit does not resolve @api path aliases
import { DATABASE_URL } from './src/env.js'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: DATABASE_URL,
  },
})
