type AppEnv = 'development' | 'test' | 'production'

export const APP_ENV: AppEnv =
  (process.env['APP_ENV'] as AppEnv | undefined) ?? 'development'

function resolveDatabaseUrl(): string {
  const explicit = process.env['DATABASE_URL']
  if (explicit) return explicit

  switch (APP_ENV) {
    case 'development':
      return 'postgresql://tq:tq@localhost:5432/tq_dev'
    case 'test':
      return 'postgresql://tq:tq@localhost:5432/tq_test'
    case 'production':
      throw new Error(
        'DATABASE_URL environment variable is required in production',
      )
  }
}

export const DATABASE_URL: string = resolveDatabaseUrl()
