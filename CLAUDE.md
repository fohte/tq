# CLAUDE.md

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
docker compose up -d                            # skip if already running
docker compose exec db createdb -U tq tq_test   # first time only
```

The Compose file uses a fixed project name (`tq-infra`), so the same PostgreSQL container is shared across all worktrees. Running `docker compose up -d` from any worktree is safe and will not create duplicate containers — skip if already running for development.

**Do NOT set `DATABASE_URL` when running tests.** `APP_ENV=test` is set automatically by `vitest.config.ts`, so `DATABASE_URL` defaults to `postgresql://tq:tq@localhost:5432/tq_test` via `api/src/env.ts`. Using `tq_dev` causes failures due to existing data.

Migrations are applied automatically by `api/src/global-setup.ts`.

## Storybook

### Write a story for every presentational component

Every presentational component under `web/src/components/` should have a co-located `<name>.stories.tsx` (e.g. `web/src/components/task/task-row.stories.tsx`, `web/src/components/ui/button.stories.tsx`). Follow the pattern of existing stories: one story per meaningful state/variant of the component.

Stories aren't just documentation — they run as the `storybook` project in `web/vitest.config.ts` (`@storybook/addon-vitest` + `@vitest/browser-playwright`), rendering each story in a real headless Chromium:

```sh
pnpm --filter web run test:storybook # vitest run --project=storybook
```

This is separate from `pnpm --filter web run test`, so writing the story is not enforced by the default test run — write it anyway when adding or changing a presentational component.

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
