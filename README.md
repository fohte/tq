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

`pnpm --filter web run test`'s `browser` vitest project renders in a headless Playwright chromium browser, which must be installed once per machine before it will pass.

```sh
pnpm --filter web exec playwright install --with-deps chromium
pnpm --filter web run test
```

Storybook stories also render in Playwright chromium, but as a separate project (`test:storybook`) that isn't part of `pnpm --filter web run test`. CI installs the browser separately for that project (`.github/workflows/vrt.yml`); locally, `--with-deps` above already covers it.

```sh
pnpm --filter web run test:storybook
```

### Browser extension

`extension/` is a Chrome extension (Manifest V3). Build it, then load it unpacked:

```sh
TQ_ORIGIN=https://tq.fohte.net pnpm --filter extension run build
```

`TQ_ORIGIN` is the tq instance the extension talks to (`host_permissions` and API requests); it must include the `http://` or `https://` scheme, and the build fails without it or with an unsupported scheme. This writes the bundled scripts and a generated `manifest.json` to `extension/dist/`. Point it at a local dev server instead: `TQ_ORIGIN=http://localhost:5173 pnpm --filter extension run build`.

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `extension/dist` directory.

Opening a URL under `TQ_ORIGIN` in a new tab from outside tq (e.g. a link in Slack) navigates and focuses the most recently used other tq tab and closes the new tab; if there is none, the new tab is left as is. Chrome lists the `tabs` permission the extension declares for this on install.

### Desktop app

`desktop/` is an Electron app (macOS) that shows tq in its own window. Build an unsigned `.app`:

```sh
TQ_ORIGIN=https://tq.fohte.net pnpm --filter desktop run package
```

`TQ_ORIGIN` is the tq instance the window loads, with the same rules as the extension's. The build writes `tq.app` under `desktop/release/` (`mac-arm64/` on Apple Silicon, `mac/` on Intel). Run it in development with `TQ_ORIGIN=... pnpm --filter desktop run start`.

- `http(s)` and `mailto:` links that leave `TQ_ORIGIN` open in the default browser. To also open a custom URL scheme, such as the one behind the session focus/resume URL templates, list it at build time: `TQ_EXTERNAL_SCHEMES=myapp,otherapp` (scheme names without the colon). Any other scheme is blocked.
- Pages outside `TQ_ORIGIN`, such as the sign-in flow, keep navigating inside the window.
- Closing the window hides it; the app keeps running and comes back from the Dock.
- Errors (a failed page load) are written to stderr, so they are visible only when started from a terminal with `pnpm --filter desktop run start`.

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

| Variable               | Required | Default                 | Description                                                                                                                                                                                                                                                                        |
| ---------------------- | -------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV`              | No       | `development`           | Application environment (`development`/`test`/`production`)                                                                                                                                                                                                                        |
| `APP_DOMAIN`           | Yes\*    | `localhost:5173`        | Public domain tq is served from, without scheme (e.g. `tq.fohte.net`); used to recognize tq URLs pasted into task text. \*Required in production only — falls back to the local Vite dev server's origin elsewhere                                                                 |
| `DATABASE_URL`         | Yes      | —                       | PostgreSQL connection URL                                                                                                                                                                                                                                                          |
| `TEST_DATABASE_URL`    | No       | —                       | PostgreSQL connection URL used for local `api` test runs instead of `DATABASE_URL` (written to `.env.runtime` by `mise run db:up`)                                                                                                                                                 |
| `CORS_ORIGIN`          | No       | `*`                     | Allowed origin for CORS requests                                                                                                                                                                                                                                                   |
| `PORT`                 | No       | `3001`                  | API server listen port                                                                                                                                                                                                                                                             |
| `VITE_API_URL`         | No       | `http://localhost:3001` | API base URL used by the web frontend (Vite build-time)                                                                                                                                                                                                                            |
| `GITHUB_CLIENT_ID`     | No       | —                       | GitHub OAuth App client ID, required to connect a GitHub account                                                                                                                                                                                                                   |
| `GITHUB_CLIENT_SECRET` | No       | —                       | GitHub OAuth App client secret, required to connect a GitHub account                                                                                                                                                                                                               |
| `GITHUB_REDIRECT_URI`  | No       | —                       | OAuth callback URL registered on the GitHub OAuth App (`<API base URL>/api/github/oauth-callback`)                                                                                                                                                                                 |
| `SLACK_CLIENT_ID`      | No       | —                       | Slack app client ID, required to connect a Slack workspace                                                                                                                                                                                                                         |
| `SLACK_CLIENT_SECRET`  | No       | —                       | Slack app client secret, required to connect a Slack workspace                                                                                                                                                                                                                     |
| `SLACK_REDIRECT_URI`   | No       | —                       | OAuth callback URL registered on the Slack app (`<API base URL>/api/slack/oauth-callback`)                                                                                                                                                                                         |
| `VAPID_PUBLIC_KEY`     | Yes\*    | —                       | VAPID public key served to browsers as the Web Push application server key. \*Required in production only — `GET /api/push/vapid-public-key` and `POST /api/push/test` answer 503 without it elsewhere. Generate a pair with `pnpm --filter api exec web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY`    | Yes\*    | —                       | VAPID private key signing Web Push requests. \*Same as above                                                                                                                                                                                                                       |

### Web (nginx runtime)

The production web image serves static files via nginx and reverse-proxies `/api` requests to the API backend. These variables are required at container runtime (no defaults in the image):

| Variable          | Required | Description                                                                   |
| ----------------- | -------- | ----------------------------------------------------------------------------- |
| `API_BACKEND_URL` | Yes      | API backend URL for nginx reverse proxy                                       |
| `NGINX_RESOLVER`  | Yes      | DNS resolver for nginx (e.g. `kube-dns.kube-system.svc.cluster.local` in k8s) |
