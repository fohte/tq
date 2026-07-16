export function resolveTestDatabaseUrl(
  currentDatabaseUrl: string | undefined,
  testDatabaseUrl: string | undefined,
): string | undefined {
  if (testDatabaseUrl == null || testDatabaseUrl === '') {
    return currentDatabaseUrl
  }

  // Only override the mise-injected tq_dev default; an explicit DATABASE_URL
  // set for this invocation (e.g. `DATABASE_URL=... pnpm test`) wins.
  if (
    currentDatabaseUrl == null ||
    currentDatabaseUrl === '' ||
    currentDatabaseUrl.includes('/tq_dev')
  ) {
    return testDatabaseUrl
  }

  return currentDatabaseUrl
}
