const APP_ENVS = ['development', 'test', 'production'] as const
type AppEnv = (typeof APP_ENVS)[number]

function isAppEnv(value: string): value is AppEnv {
  return (APP_ENVS as readonly string[]).includes(value)
}

function resolveAppEnv(): AppEnv {
  const env = process.env['APP_ENV']
  if (env === undefined) return 'development'
  if (isAppEnv(env)) return env
  throw new Error(
    `Invalid APP_ENV: "${env}". Must be one of: ${APP_ENVS.join(', ')}`,
  )
}

export const APP_ENV: AppEnv = resolveAppEnv()

function resolveDatabaseUrl(): string {
  const explicit = process.env['DATABASE_URL']
  if (explicit != null && explicit !== '') return explicit

  switch (APP_ENV) {
    case 'development':
      return 'postgresql://tq:tq@localhost:5432/tq_dev'
    case 'test':
      return 'postgresql://tq:tq@localhost:5432/tq_test'
    case 'production':
      throw new Error(
        'DATABASE_URL environment variable is required in production',
      )
    default: {
      const exhaustiveCheck: never = APP_ENV
      throw new Error(`Unhandled APP_ENV: ${String(exhaustiveCheck)}`)
    }
  }
}

export const DATABASE_URL: string = resolveDatabaseUrl()
