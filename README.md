# tq

**tq** (task queue) is a task management tool for @fohte.

## Development

### Prerequisites

- [mise](https://mise.jdx.dev/) (manages Node.js, pnpm, and other tool versions via `.mise.toml`)
- Docker + docker compose plugin ([Docker Desktop](https://www.docker.com/) or [Colima](https://github.com/abiosoft/colima))

### Setup

```sh
scripts/bootstrap
docker compose up -d
export DATABASE_URL="postgres://tq:tq@localhost:5432/tq_dev"
pnpm --filter api run db:migrate
pnpm dev
```

`pnpm dev` starts both the API server and the Vite dev server concurrently.

### Testing

Tests are run with `pnpm run test`, which executes tests across all workspaces.

#### API integration tests

API integration tests require a running PostgreSQL instance and a dedicated test database (`tq_test`).

```sh
# 1. Start PostgreSQL via Docker (skip if already running for development)
docker compose up -d

# 2. Create the test database (first time only)
docker compose exec db createdb -U tq tq_test

# 3. Run API tests
pnpm --filter api run test
```

The Compose file uses a fixed project name (`tq-infra`), so the same PostgreSQL container is shared across all worktrees. Running `docker compose up -d` from any worktree is safe and will not create duplicate containers.

When `DATABASE_URL` is not set, tests automatically connect to `postgresql://tq:tq@localhost:5432/tq_test`. Do **not** set `DATABASE_URL` for testing — using the development database (`tq_dev`) will cause test failures because of existing data.

Migrations are applied automatically by the test global setup (`api/src/global-setup.ts`), so there is no need to run `db:migrate` manually for the test database.

#### Web tests

```sh
pnpm --filter web run test
```

### Scripts

| Command                             | Description                          |
| ----------------------------------- | ------------------------------------ |
| `pnpm run lint`                     | Run ESLint                           |
| `pnpm run format`                   | Auto-fix lint issues and format code |
| `pnpm run test`                     | Run all tests across workspaces      |
| `pnpm --filter web run storybook`   | Start Storybook dev server           |
| `pnpm --filter api run db:generate` | Generate a new DB migration          |
| `pnpm --filter api run db:migrate`  | Apply DB migrations                  |

## Environment Variables

The API server and web frontend are configured via environment variables.

| Variable       | Required | Default                 | Description                                             |
| -------------- | -------- | ----------------------- | ------------------------------------------------------- |
| `DATABASE_URL` | Yes      | -                       | PostgreSQL connection URL                               |
| `CORS_ORIGIN`  | No       | `*`                     | Allowed origin for CORS requests                        |
| `PORT`         | No       | `3001`                  | API server listen port                                  |
| `VITE_API_URL` | No       | `http://localhost:3001` | API base URL used by the web frontend (Vite build-time) |
