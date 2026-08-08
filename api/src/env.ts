import { optionalEnum, parseEnv, requireString } from '@fohte/service-kit/env'
import { err, type Result } from 'neverthrow'

const APP_ENVS = ['development', 'test', 'production'] as const
type AppEnv = (typeof APP_ENVS)[number]

const appEnvResult = optionalEnum(
  process.env,
  'APP_ENV',
  APP_ENVS,
  'development',
)

// APP_ENV itself may be invalid, but the hint below is cosmetic (which
// `mise run db:up` database name to suggest) — falling back to
// 'development' here doesn't hide the real APP_ENV issue, which parseEnv
// reports separately below.
function resolveDatabaseUrl(appEnv: AppEnv): Result<string, string> {
  const explicit = requireString(process.env, 'DATABASE_URL')
  if (explicit.isOk()) return explicit

  if (appEnv === 'production') {
    return err('DATABASE_URL environment variable is required in production')
  }
  const dbName = appEnv === 'test' ? 'tq_test' : 'tq_dev'
  return err(
    `DATABASE_URL environment variable is required (run \`mise run db:up\` to start Postgres and generate .env.runtime, or set DATABASE_URL=postgresql://tq:tq@localhost:<port>/${dbName} manually)`,
  )
}

const parsed = parseEnv({
  APP_ENV: appEnvResult,
  DATABASE_URL: resolveDatabaseUrl(appEnvResult.unwrapOr('development')),
})

if (parsed.isErr()) {
  // eslint-disable-next-line no-restricted-syntax -- throws at module-eval time, before the Hono app (and its app.onError Sentry hook) exists, so there's no Result to return to
  throw parsed.error
}

export const APP_ENV: AppEnv = parsed.value.APP_ENV
export const DATABASE_URL: string = parsed.value.DATABASE_URL
