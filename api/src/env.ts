import { optionalEnum, parseEnv, requireString } from '@fohte/service-kit/env'
import { err, ok, type Result } from 'neverthrow'

const APP_ENVS = ['development', 'test', 'production'] as const
type AppEnv = (typeof APP_ENVS)[number]

// An empty APP_ENV is treated the same as unset (falls back to
// 'development'), not rejected as invalid.
const appEnvResult = optionalEnum(
  process.env,
  'APP_ENV',
  APP_ENVS,
  'development',
)

// Shared shape for env vars required in production but given a dev/test
// fallback elsewhere: prefer the explicit value, then either fail (in
// production) or fall back (elsewhere) via `onMissing`.
function resolveRequiredInProduction(
  varName: string,
  appEnv: AppEnv,
  onMissing: () => Result<string, string>,
): Result<string, string> {
  const explicit = requireString(process.env, varName)
  if (explicit.isOk()) return explicit

  if (appEnv === 'production') {
    return err(`${varName} environment variable is required in production`)
  }
  return onMissing()
}

// APP_ENV itself may be invalid, but the hint below is cosmetic (which
// `mise run db:up` database name to suggest) — falling back to
// 'development' here doesn't hide the real APP_ENV issue, which parseEnv
// reports separately below.
function resolveDatabaseUrl(appEnv: AppEnv): Result<string, string> {
  return resolveRequiredInProduction('DATABASE_URL', appEnv, () => {
    const dbName = appEnv === 'test' ? 'tq_test' : 'tq_dev'
    return err(
      `DATABASE_URL environment variable is required (run \`mise run db:up\` to start Postgres and generate .env.runtime, or set DATABASE_URL=postgresql://tq:tq@localhost:<port>/${dbName} manually)`,
    )
  })
}

// Public domain tq is served from (no scheme, e.g. `tq.fohte.net`), used to
// recognize tq URLs pasted into task text. Required in production, since a
// missing value there would silently disable URL resolution rather than
// fail loudly; defaults to the local Vite dev server's origin elsewhere so
// `pnpm dev` needs no extra setup.
function resolveAppDomain(appEnv: AppEnv): Result<string, string> {
  return resolveRequiredInProduction('APP_DOMAIN', appEnv, () =>
    ok('localhost:5173'),
  )
}

const parsed = parseEnv({
  APP_ENV: appEnvResult,
  DATABASE_URL: resolveDatabaseUrl(appEnvResult.unwrapOr('development')),
  APP_DOMAIN: resolveAppDomain(appEnvResult.unwrapOr('development')),
})

if (parsed.isErr()) {
  // eslint-disable-next-line no-restricted-syntax -- throws at module-eval time, before the Hono app (and its app.onError Sentry hook) exists, so there's no Result to return to
  throw parsed.error
}

export const DATABASE_URL: string = parsed.value.DATABASE_URL
export const APP_DOMAIN: string = parsed.value.APP_DOMAIN
