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
