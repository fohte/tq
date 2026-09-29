# tq

**tq** (task queue) is a task management tool for @fohte.

## Development

### Prerequisites

- [mise](https://mise.jdx.dev/) (manages Node.js, pnpm, and other tool versions)
- Docker + docker compose plugin ([Docker Desktop](https://www.docker.com/) or [Colima](https://github.com/abiosoft/colima))

### Setup

```sh
scripts/bootstrap
mise run db:up
pnpm --filter api run db:migrate
pnpm dev
```

### Testing

Tests are run with `pnpm run test`, which executes tests across all workspaces.

#### API integration tests

API integration tests require a running PostgreSQL instance and a dedicated test database (`tq_test`).

```sh
# 1. Start PostgreSQL (skip if already running)
mise run db:up

# 2. Create the test database (first time only)
docker compose exec db createdb -U tq tq_test

# 3. Run API tests
pnpm --filter api run test
```

Migrations are applied automatically when API tests run.

#### Web tests

Install Chromium once before running web or Storybook tests:

```sh
pnpm --filter web exec playwright install --with-deps chromium
pnpm --filter web run test
```

```sh
pnpm --filter web run test:storybook
```

### Browser extension

Build the Chrome extension, then load it unpacked:

```sh
TQ_ORIGIN=https://tq.fohte.net pnpm --filter extension run build
```

Set `TQ_ORIGIN` to the tq instance used by the extension. Include the `http://` or `https://` scheme. To use a local dev server, set `TQ_ORIGIN=http://localhost:5173`. The build output is `extension/dist/`.

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `extension/dist` directory.

Opening a URL under `TQ_ORIGIN` from outside tq opens it in the tq desktop app. Install the desktop app with the `tq://` link handler registered (see Desktop app below). Navigations from a tq page stay in the browser.

### Desktop app

The desktop app shows tq in its own window. Build an unsigned `.app`:

```sh
TQ_ORIGIN=https://tq.fohte.net pnpm --filter desktop run package
```

Set `TQ_ORIGIN` to the tq instance the window loads, using an `http://` or `https://` URL. The packaged app is written under `desktop/release/` (`mac-arm64/` on Apple Silicon, `mac/` on Intel). Run it in development with `TQ_ORIGIN=... pnpm --filter desktop run start`.

- `http(s)` and `mailto:` links that leave `TQ_ORIGIN` open in the default browser. To allow custom URL schemes, set `TQ_EXTERNAL_SCHEMES` to comma-separated scheme names without the colon. Other schemes are blocked.
- Pages outside `TQ_ORIGIN`, such as the sign-in flow, keep navigating inside the window.
- Back / Forward are in the History menu (`Cmd+[` / `Cmd+]`); the window has no browser toolbar.
- Copy the current page URL from the Page menu with `Cmd+Shift+C`; the window has no address bar.
- A `tq://<host>/<path>` link opens the same path on `TQ_ORIGIN` in the window, e.g. `tq://tq.fohte.net/tasks/1` opens `https://tq.fohte.net/tasks/1` for `TQ_ORIGIN=https://tq.fohte.net`. A link whose host (including any port) differs from `TQ_ORIGIN` is ignored. Only the packaged app registers the scheme, not `pnpm --filter desktop run start`.
- Closing the window hides it; the app keeps running and comes back from the Dock.

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

| Variable               | Required | Default                 | Description                                                                                                                                                                                                        |
| ---------------------- | -------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `APP_ENV`              | No       | `development`           | Application environment (`development`/`test`/`production`)                                                                                                                                                        |
| `ASSET_MAX_SIZE_BYTES` | No       | `10485760`              | Maximum size in bytes for a single asset upload. Must be a positive integer                                                                                                                                        |
| `APP_DOMAIN`           | Yes\*    | `localhost:5173`        | Public domain tq is served from, without scheme (e.g. `tq.fohte.net`); used to recognize tq URLs pasted into task text. \*Required in production only — falls back to the local Vite dev server's origin elsewhere |
| `DATABASE_URL`         | Yes      | —                       | PostgreSQL connection URL                                                                                                                                                                                          |
| `TEST_DATABASE_URL`    | No       | —                       | PostgreSQL connection URL used for local `api` test runs instead of `DATABASE_URL`                                                                                                                                 |
| `CORS_ORIGIN`          | No       | `*`                     | Allowed origin for CORS requests                                                                                                                                                                                   |
| `PORT`                 | No       | `3001`                  | API server listen port                                                                                                                                                                                             |
| `VITE_API_URL`         | No       | `http://localhost:3001` | API base URL used by the web frontend (Vite build-time)                                                                                                                                                            |
| `GITHUB_CLIENT_ID`     | No       | —                       | GitHub OAuth App client ID, required to connect a GitHub account                                                                                                                                                   |
| `GITHUB_CLIENT_SECRET` | No       | —                       | GitHub OAuth App client secret, required to connect a GitHub account                                                                                                                                               |
| `GITHUB_REDIRECT_URI`  | No       | —                       | OAuth callback URL registered on the GitHub OAuth App (`<API base URL>/api/github/oauth-callback`)                                                                                                                 |
| `SLACK_CLIENT_ID`      | No       | —                       | Slack app client ID, required to connect a Slack workspace                                                                                                                                                         |
| `SLACK_CLIENT_SECRET`  | No       | —                       | Slack app client secret, required to connect a Slack workspace                                                                                                                                                     |
| `SLACK_REDIRECT_URI`   | No       | —                       | OAuth callback URL registered on the Slack app (`<API base URL>/api/slack/oauth-callback`)                                                                                                                         |
| `VAPID_PUBLIC_KEY`     | Yes\*    | —                       | VAPID public key for Web Push. \*Required in production only. Generate a pair with `pnpm --filter api exec web-push generate-vapid-keys`                                                                           |
| `VAPID_PRIVATE_KEY`    | Yes\*    | —                       | VAPID private key for Web Push. \*Same as above                                                                                                                                                                    |

### Web container runtime

These variables are required when running the web container:

| Variable          | Required | Default | Description                             |
| ----------------- | -------- | ------- | --------------------------------------- |
| `API_BACKEND_URL` | Yes      | —       | API backend URL                         |
| `NGINX_RESOLVER`  | Yes      | —       | DNS resolver address for the web server |
