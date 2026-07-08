import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

export default function globalSetup(): void {
  execFileSync('pnpm', ['--filter', 'api', 'run', 'db:migrate'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, APP_ENV: 'test' },
  })
}
