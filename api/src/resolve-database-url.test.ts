import { describe, expect, it } from 'vitest'

import { type AppEnv, resolveDatabaseUrl } from '#resolve-database-url'

function normalizeResult(result: ReturnType<typeof resolveDatabaseUrl>) {
  return result.match(
    (value) => ({ value }),
    (error) => ({ error }),
  )
}

describe('resolveDatabaseUrl', () => {
  it.each([
    ['development', 'tq_api_dev'],
    ['test', 'tq_api_test'],
  ] as const)(
    'suggests the %s database when DATABASE_URL is unset',
    (appEnv, databaseName) => {
      expect(normalizeResult(resolveDatabaseUrl({}, appEnv as AppEnv))).toEqual(
        {
          error: `DATABASE_URL environment variable is required (run \`mise run db:up\` to start Postgres and create local databases, or set DATABASE_URL=postgresql://tq:tq@localhost:<port>/${databaseName} manually)`,
        },
      )
    },
  )

  it('suggests starting Postgres when mise supplies its unavailable-port URL', () => {
    expect(
      normalizeResult(
        resolveDatabaseUrl(
          { DATABASE_URL: 'postgresql://tq:tq@127.0.0.1:0/tq_api_dev' },
          'development',
        ),
      ),
    ).toEqual({
      error:
        'DATABASE_URL environment variable is required (run `mise run db:up` to start Postgres and create local databases, or set DATABASE_URL=postgresql://tq:tq@localhost:<port>/tq_api_dev manually)',
    })
  })

  it('keeps an explicit database URL', () => {
    expect(
      normalizeResult(
        resolveDatabaseUrl(
          {
            DATABASE_URL:
              'postgresql://user:password@db.example.test:5432/tasks',
          },
          'development',
        ),
      ),
    ).toEqual({
      value: 'postgresql://user:password@db.example.test:5432/tasks',
    })
  })

  it('requires an explicit database URL in production', () => {
    expect(normalizeResult(resolveDatabaseUrl({}, 'production'))).toEqual({
      error: 'DATABASE_URL environment variable is required in production',
    })
  })
})
