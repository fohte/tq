const APP_ENVS = ['development', 'test', 'production'] as const
type AppEnv = (typeof APP_ENVS)[number]

function isAppEnv(value: string): value is AppEnv {
  return (APP_ENVS as readonly string[]).includes(value)
}

function resolveAppEnv(): AppEnv {
  const env = process.env['APP_ENV']
  if (env === undefined) return 'development'
  if (isAppEnv(env)) return env
  // eslint-disable-next-line no-restricted-syntax -- throws at module-eval time, before the Hono app (and its app.onError Sentry hook) exists, so there's no Result to return to
  throw new Error(
    `Invalid APP_ENV: "${env}". Must be one of: ${APP_ENVS.join(', ')}`,
  )
}

export const APP_ENV: AppEnv = resolveAppEnv()

function resolveDatabaseUrl(): string {
  const explicit = process.env['DATABASE_URL']
  if (explicit != null && explicit !== '') return explicit

  if (APP_ENV === 'production') {
    // eslint-disable-next-line no-restricted-syntax -- see comment above
    throw new Error(
      'DATABASE_URL environment variable is required in production',
    )
  }
  const dbName = APP_ENV === 'test' ? 'tq_test' : 'tq_dev'
  // eslint-disable-next-line no-restricted-syntax -- see comment above
  throw new Error(
    `DATABASE_URL environment variable is required (run \`mise run db:up\` to start Postgres and generate .env.runtime, or set DATABASE_URL=postgresql://tq:tq@localhost:<port>/${dbName} manually)`,
  )
}

export const DATABASE_URL: string = resolveDatabaseUrl()
