import { resolveTestDatabaseUrl } from '@api/resolve-test-database-url'
import { describe, expect, it } from 'vitest'

describe('resolveTestDatabaseUrl', () => {
  it('keeps the current value when TEST_DATABASE_URL is unset', () => {
    expect(
      resolveTestDatabaseUrl(
        'postgresql://tq:tq@localhost:1/tq_dev',
        undefined,
      ),
    ).toBe('postgresql://tq:tq@localhost:1/tq_dev')
  })

  it('uses TEST_DATABASE_URL when the current value is unset', () => {
    expect(
      resolveTestDatabaseUrl(
        undefined,
        'postgresql://tq:tq@localhost:1/tq_test',
      ),
    ).toBe('postgresql://tq:tq@localhost:1/tq_test')
  })

  it('uses TEST_DATABASE_URL when the current value points at tq_dev', () => {
    expect(
      resolveTestDatabaseUrl(
        'postgresql://tq:tq@localhost:1/tq_dev',
        'postgresql://tq:tq@localhost:1/tq_test',
      ),
    ).toBe('postgresql://tq:tq@localhost:1/tq_test')
  })

  it('preserves an explicit DATABASE_URL that does not point at tq_dev', () => {
    expect(
      resolveTestDatabaseUrl(
        'postgresql://tq:tq@localhost:1/custom_db',
        'postgresql://tq:tq@localhost:1/tq_test',
      ),
    ).toBe('postgresql://tq:tq@localhost:1/custom_db')
  })

  it('preserves an explicit DATABASE_URL that only shares the tq_dev prefix', () => {
    expect(
      resolveTestDatabaseUrl(
        'postgresql://tq:tq@localhost:1/tq_dev_snapshot',
        'postgresql://tq:tq@localhost:1/tq_test',
      ),
    ).toBe('postgresql://tq:tq@localhost:1/tq_dev_snapshot')
  })

  it('uses TEST_DATABASE_URL when the current value points at tq_dev with a query string', () => {
    expect(
      resolveTestDatabaseUrl(
        'postgresql://tq:tq@localhost:1/tq_dev?sslmode=disable',
        'postgresql://tq:tq@localhost:1/tq_test',
      ),
    ).toBe('postgresql://tq:tq@localhost:1/tq_test')
  })

  it('keeps the current value when TEST_DATABASE_URL is an empty string', () => {
    expect(
      resolveTestDatabaseUrl('postgresql://tq:tq@localhost:1/tq_dev', ''),
    ).toBe('postgresql://tq:tq@localhost:1/tq_dev')
  })

  it('uses TEST_DATABASE_URL when the current value is an empty string', () => {
    expect(
      resolveTestDatabaseUrl('', 'postgresql://tq:tq@localhost:1/tq_test'),
    ).toBe('postgresql://tq:tq@localhost:1/tq_test')
  })
})
