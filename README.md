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
DATABASE_URL=postgres://tq:tq@localhost:5432/tq_dev pnpm --filter api run dev
```

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

## Environment Variables

### API server

| Variable       | Required | Default | Description                                                               |
| -------------- | -------- | ------- | ------------------------------------------------------------------------- |
| `DATABASE_URL` | Yes      | -       | PostgreSQL connection URL (e.g. `postgres://tq:tq@localhost:5432/tq_dev`) |
| `CORS_ORIGIN`  | No       | `*`     | Allowed origin for CORS requests (e.g. `http://localhost:5173`)           |
| `PORT`         | No       | `3001`  | Listen port                                                               |

### Web frontend (build-time)

| Variable       | Required | Default                 | Description                       |
| -------------- | -------- | ----------------------- | --------------------------------- |
| `VITE_API_URL` | No       | `http://localhost:3001` | API base URL used by the frontend |

### Docker Compose (local development only)

| Variable   | Required | Default | Description                                  |
| ---------- | -------- | ------- | -------------------------------------------- |
| `APP_PORT` | No       | `3001`  | Host-side port mapping for the API container |
| `WEB_PORT` | No       | `5173`  | Host-side port mapping for the web container |

## Scripts

| Command                             | Description                          |
| ----------------------------------- | ------------------------------------ |
| `pnpm run lint`                     | Run ESLint                           |
| `pnpm run format`                   | Auto-fix lint issues and format code |
| `pnpm run test`                     | Run all tests across workspaces      |
| `pnpm --filter web run storybook`   | Start Storybook dev server           |
| `pnpm --filter api run db:generate` | Generate a new DB migration          |
| `pnpm --filter api run db:migrate`  | Apply DB migrations                  |
