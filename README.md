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

### Run with Docker Compose (production build)

Build and run the full stack (API + frontend) in a container:

```sh
# DB must be running (step 2)
docker compose up --build
```

This builds the frontend, serves it from the Hono API server, and exposes the app on `http://localhost:3001`.

### Git worktree parallel development

The DB runs once via `docker-compose.infra.yml` and is shared across worktrees. Set `APP_PORT` in each worktree to avoid port conflicts:

```sh
APP_PORT=3002 docker compose up --build
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
