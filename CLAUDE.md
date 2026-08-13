# CLAUDE.md

## Code organization rules

### Split files before they grow past ~500 lines of production code

When a change would push a file's non-test code past ~500 lines, split it along responsibility seams before adding more. Splits must be move-only commits: no logic changes, renames, or reformatting mixed in. Keep external import paths unchanged by keeping the entrypoint file in place and re-exporting the pieces you split out into new files (e.g. `index.ts` re-exports from the new files). Tests move together with the code they verify.

Prefer creating a new focused file over appending to the largest existing one.

## Testing

### Running tests

```sh
pnpm run test              # all workspaces
pnpm --filter api run test # API only (runs tsc --noEmit + vitest in parallel)
pnpm --filter web run test # web only
```

### API integration tests — database setup

API integration tests require PostgreSQL running via Docker.

```sh
mise run db:up                                  # skip if already running
docker compose exec db createdb -U tq tq_test   # first time only
```

The Compose file uses a fixed project name (`tq-infra`), so the same PostgreSQL container is shared across all worktrees. Running `mise run db:up` from any worktree is safe and will not create duplicate containers — skip if already running for development.

The `db` service publishes Postgres on a random host port to avoid clashing with other projects. `mise run db:up` resolves the assigned port and writes it to `.env.runtime` as both `DATABASE_URL` (`tq_dev`) and `TEST_DATABASE_URL` (`tq_test`); mise loads both automatically and `api`'s test runs prefer `TEST_DATABASE_URL`. Do not point `DATABASE_URL` at `tq_dev` for tests — existing data there causes test failures.

Migrations are applied automatically by `api/src/global-setup.ts`.

## Error handling rules

### Return a `Result` instead of throwing

`errorHandling` in `eslint.config.js` bans `throw`/`try-catch` in production code and requires every returned `Result` to be consumed (`no-restricted-syntax`, `neverthrow/must-use-result` in `@fohte/eslint-config`). This only applies to `api/src/**` — `web/` and root config files keep using `throw`/`try-catch` and never import `neverthrow`. Return a `Result`/`ResultAsync` from [neverthrow](https://github.com/supermacro/neverthrow) instead:

```ts
// bad: throws
function parseConfig(raw: string): Config {
  if (!isValid(raw)) throw new Error('invalid config')
  return JSON.parse(raw)
}

// good: returns a Result
function parseConfig(raw: string): Result<Config, ConfigError> {
  if (!isValid(raw)) return err(new ConfigError('invalid config'))
  return ok(JSON.parse(raw))
}
```

Use `ResultAsync.fromPromise()` or `Result.fromThrowable()` to interop with a throwing API without a local try/catch. If the throw-based contract genuinely can't be wrapped that way, catch the exception, wrap it in a `BoundaryError` subclass (see `api/src/errors.ts`), and rethrow it — `no-restricted-syntax` bans `try`/`throw` as separate selectors, so both the `try` and the `throw` need their own `eslint-disable-next-line no-restricted-syntax` comment explaining why.

## Storybook

### Write a story for every presentational component

Every presentational component under `web/src/components/` should have a co-located `.stories.tsx` file matching the component's filename (e.g. `web/src/components/task/task-row.stories.tsx` for `task-row.tsx`). If a source file exports multiple components, give each one its own `<component-name>.stories.tsx` file instead of matching the source filename (e.g. `task-row.tsx` exports `TaskRow` and `TreeTaskRow`, backed by `task-row.stories.tsx` and `tree-task-row.stories.tsx` respectively). Follow the pattern of existing stories: one story per meaningful state/variant of the component. If a component depends on routing or React Query, wrap it in a local provider helper in the story file (see `task-row.stories.tsx` for a reference implementation).

Stories aren't just documentation — they run as the `storybook` project in `web/vitest.config.ts` (`@storybook/addon-vitest` + `@vitest/browser-playwright`), rendering each story in a real headless Chromium:

```sh
pnpm --filter web run test:storybook # vitest run --project=storybook && vitest run --project=storybook-mobile
```

This is separate from `pnpm --filter web run test`, so writing the story is not enforced by the default test run — write it anyway when adding or changing a presentational component.

### Extract route-inline UI that has its own appearance or state

Stories are the only thing the VRT job (`vrt / shard (storybook, N)` / `vrt / shard (storybook-mobile, N)`) renders and screenshots. Route files under `web/src/routes/` are never rendered by a story, so UI written inline in a route — a `<select>`, a checkbox, a column header, an empty state, a full-screen loading/not-found view — has no visual-regression coverage even when the rule above (every presentational component under `web/src/components/` has a story) is fully satisfied.

Keep in the route file: data fetching (React Query hooks), URL search param validation/updates, and composing already-extracted, already-storied components into the screen layout. Extract into `web/src/components/` (with a story) anything that has its own visual appearance or state, even a few lines of JSX, since a story is the only way it gets checked for a visual regression.

Boundary in practice: `web/src/routes/index.tsx` renders nothing itself and delegates entirely to `DayViewPresentation` — the target shape for a route file. `web/src/routes/settings.tsx`'s `SettingsIntegrationRow` stays inline because it only calls a hook and forwards the result to the already-storied `IntegrationCard`; it introduces no new appearance to verify. (That same file's loading/error text in `Settings()` is the kind of inline UI this rule targets — predating the rule, not an example to follow.)

### Prefer Storybook over manual browser checks

When you need to check how a component looks or behaves in a given state, write or update its story and run it via `pnpm --filter web run test:storybook` (or `pnpm --filter web run storybook` for interactive inspection) before starting a dev server and driving a browser manually.

## Test code rules

### Assert on the whole output with a single equality check

Treat each test as a spec: build the expected output as one literal value (object, struct, JSON, array, etc.) and compare it to the actual output with a single equality assertion. Do not split the assertion into per-field checks, and do not use partial matchers (substring contains, `toContain`, `toMatchObject`, prefix/suffix checks, regex-on-substring, etc.). Partial matches silently ignore unexpected fields and extra elements, so the test stops working as a spec the moment the shape of the output changes.

```ts
// bad: picks fields one by one — silent on any new/changed field
const ev = run()
expect(ev.path).toBe('/a')
expect(ev.event).toBe('ok')
expect(ev.message).toContain('done')

// good: one literal, one equality — any drift in shape fails the test
expect(run()).toEqual({
  path: '/a',
  event: 'ok',
  message: 'done',
})
```

For dynamic fields (timestamps, UUIDs, random IDs), normalize them in a helper before the comparison (e.g. replace with a fixed placeholder) so the full output can still be asserted in one equality check. Do not weaken the assertion to dodge the dynamic value.
