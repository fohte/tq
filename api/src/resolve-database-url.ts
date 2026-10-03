import { requireString } from '@fohte/service-kit/env'
import { err, type Result } from 'neverthrow'

export type AppEnv = 'development' | 'test' | 'production'

function isUnavailableLocalUrl(value: string): boolean {
  return /^postgres(?:ql)?:\/\/(?:[^@/]+@)?(?:127\.0\.0\.1|localhost):0(?:\/|$)/i.test(
    value,
  )
}

export function resolveDatabaseUrl(
  env: NodeJS.ProcessEnv,
  appEnv: AppEnv,
): Result<string, string> {
  const databaseUrl = requireString(env, 'DATABASE_URL')
  if (databaseUrl.isOk() && !isUnavailableLocalUrl(databaseUrl.value)) {
    return databaseUrl
  }

  if (appEnv === 'production') {
    return err('DATABASE_URL environment variable is required in production')
  }

  const dbName = appEnv === 'test' ? 'tq_api_test' : 'tq_api_dev'
  return err(
    `DATABASE_URL environment variable is required (run \`mise run db:up\` to start Postgres and create local databases, or set DATABASE_URL=postgresql://tq:tq@localhost:<port>/${dbName} manually)`,
  )
}
