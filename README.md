# tq

**tq** (task queue) is a task management tool for @fohte.

## Prerequisites

- [mise](https://mise.jdx.dev/) (manages Node.js, pnpm, and other tool versions via `.mise.toml`)
- [Docker](https://www.docker.com/) (for PostgreSQL)

## Getting Started

### 1. Set up the development environment

```sh
scripts/bootstrap
```

This installs tool versions (via mise), git hooks (via lefthook), and Node.js dependencies (via pnpm).

### 2. Start PostgreSQL

```sh
docker compose up -d
```

This starts a PostgreSQL 17 container (`localhost:5432`, user: `tq`, password: `tq`, database: `tq_dev`).

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

## Scripts

| Command                             | Description                          |
| ----------------------------------- | ------------------------------------ |
| `pnpm run lint`                     | Run ESLint                           |
| `pnpm run format`                   | Auto-fix lint issues and format code |
| `pnpm run test`                     | Run all tests across workspaces      |
| `pnpm --filter web run storybook`   | Start Storybook dev server           |
| `pnpm --filter api run db:generate` | Generate a new DB migration          |
| `pnpm --filter api run db:migrate`  | Apply DB migrations                  |
