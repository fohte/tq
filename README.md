# tq

**tq** (task queue) is a task management tool for @fohte.

## Prerequisites

- [mise](https://mise.jdx.dev/) (manages Node.js, pnpm, and other tool versions via `.mise.toml`)
- Docker + docker compose plugin ([Docker Desktop](https://www.docker.com/) or [Colima](https://github.com/abiosoft/colima))

## Getting Started

### 1. Set up the development environment

```sh
scripts/bootstrap
```

This installs tool versions (via mise), git hooks (via lefthook), and Node.js dependencies (via pnpm).

### 2. Start the DB (once per machine)

```sh
docker compose -f docker-compose.infra.yml up -d
```

This starts a PostgreSQL 17 container on `localhost:5432`. The DB is shared across all worktrees.

### 3. Run database migrations

```sh
DATABASE_URL=postgres://tq:tq@localhost:5432/tq_dev pnpm --filter api run db:migrate
```

### 4. Start development servers

API server (port 3001):

```sh
DATABASE_URL=postgres://tq:tq@localhost:5432/tq_dev CORS_ORIGIN=http://localhost:5173 pnpm --filter api run dev
```

`CORS_ORIGIN` sets the allowed origin for CORS requests. Defaults to `*` (all origins) if omitted.

Web dev server:

```sh
pnpm --filter web run dev
```

### Run the full stack with Docker Compose

```sh
# DB must be running (step 2)
docker compose up --build
```

Run DB migrations and open `http://localhost:5173` in a browser:

```sh
DATABASE_URL=postgres://tq:tq@localhost:5432/tq_dev pnpm --filter api run db:migrate
open http://localhost:5173
```

### Git worktree parallel development

The DB runs once via `docker-compose.infra.yml` and is shared across worktrees. Set `APP_PORT` and `WEB_PORT` in each worktree to avoid port conflicts:

```sh
APP_PORT=3002 WEB_PORT=5174 docker compose up --build
```

## Scripts

| Command                             | Description                          |
| ----------------------------------- | ------------------------------------ |
| `pnpm run lint`                     | Run ESLint                           |
| `pnpm run format`                   | Auto-fix lint issues and format code |
| `pnpm run test`                     | Run all tests across workspaces      |
| `pnpm --filter web run storybook`   | Start Storybook dev server           |
| `pnpm --filter api run db:generate` | Generate a new DB migration          |
| `pnpm --filter api run db:migrate`  | Apply DB migrations                  |
