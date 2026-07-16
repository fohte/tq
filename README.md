# tq

**tq** (task queue) is a task management tool for @fohte.

## Development

### Prerequisites

- [mise](https://mise.jdx.dev/) (manages Node.js, pnpm, and other tool versions via `.mise.toml`)
- Docker + docker compose plugin ([Docker Desktop](https://www.docker.com/) or [Colima](https://github.com/abiosoft/colima))

### Setup

```sh
scripts/bootstrap
mise run db:up
pnpm --filter api run db:migrate
pnpm dev
```

`pnpm dev` starts both the API server and the Vite dev server concurrently. The `db` service is published to a random host port to avoid clashing with other projects' Postgres instances — `mise run db:up` resolves it and writes `.env.runtime` with the correct `DATABASE_URL`, which mise loads automatically.

### Testing

Tests are run with `pnpm run test`, which executes tests across all workspaces.

#### API integration tests

API integration tests require a running PostgreSQL instance and a dedicated test database (`tq_test`).

```sh
# 1. Start PostgreSQL via Docker and write .env.runtime (skip if already running for development)
mise run db:up

# 2. Create the test database (first time only)
docker compose exec db createdb -U tq tq_test

# 3. Run API tests
pnpm --filter api run test
```

The Compose file uses a fixed project name (`tq-infra`), so the same PostgreSQL container is shared across all worktrees. Running `mise run db:up` from any worktree is safe and will not create duplicate containers.

`mise run db:up` writes `.env.runtime` with both `DATABASE_URL` (pointed at `tq_dev`) and `TEST_DATABASE_URL` (pointed at `tq_test`). mise loads both automatically, and `pnpm --filter api run test` prefers `TEST_DATABASE_URL` on its own — no manual port lookup or `export` needed, and dev data in `tq_dev` is never at risk.

Migrations are applied automatically by the test global setup (`api/src/global-setup.ts`), so there is no need to run `db:migrate` manually for the test database.

#### Web tests

Storybook interaction tests run in a headless Playwright chromium browser, which must be installed once per machine.

```sh
pnpm --filter web exec playwright install --with-deps chromium
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

## License

[AGPL-3.0](LICENSE)

## Environment Variables

The API server and web frontend are configured via environment variables.

| Variable            | Required | Default                 | Description                                                                                                                        |
| ------------------- | -------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV`           | No       | `development`           | Application environment (`development`/`test`/`production`)                                                                        |
| `DATABASE_URL`      | Yes      | —                       | PostgreSQL connection URL                                                                                                          |
| `TEST_DATABASE_URL` | No       | —                       | PostgreSQL connection URL used for local `api` test runs instead of `DATABASE_URL` (written to `.env.runtime` by `mise run db:up`) |
| `CORS_ORIGIN`       | No       | `*`                     | Allowed origin for CORS requests                                                                                                   |
| `PORT`              | No       | `3001`                  | API server listen port                                                                                                             |
| `VITE_API_URL`      | No       | `http://localhost:3001` | API base URL used by the web frontend (Vite build-time)                                                                            |

### Web (nginx runtime)

The production web image serves static files via nginx and reverse-proxies `/api` requests to the API backend. These variables are required at container runtime (no defaults in the image):

| Variable          | Required | Description                                                                   |
| ----------------- | -------- | ----------------------------------------------------------------------------- |
| `API_BACKEND_URL` | Yes      | API backend URL for nginx reverse proxy                                       |
| `NGINX_RESOLVER`  | Yes      | DNS resolver for nginx (e.g. `kube-dns.kube-system.svc.cluster.local` in k8s) |
