# tq

**tq** (task queue) is a task management tool for @fohte.

## Development

### Prerequisites

- [mise](https://mise.jdx.dev/) (manages Node.js, pnpm, and other tool versions via `.mise.toml`)
- Docker + docker compose plugin ([Docker Desktop](https://www.docker.com/) or [Colima](https://github.com/abiosoft/colima))

### Setup

```sh
scripts/bootstrap
docker compose -f docker-compose.infra.yml up -d
DATABASE_URL=postgres://tq:tq@localhost:5432/tq_dev pnpm --filter api run db:migrate
DATABASE_URL=postgres://tq:tq@localhost:5432/tq_dev pnpm dev
```

`pnpm dev` starts both the API server and the Vite dev server concurrently. Environment variables can also be set via a `.env` file in the project root.

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
