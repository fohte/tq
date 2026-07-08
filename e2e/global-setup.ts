import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

export default function globalSetup(): void {
  // execFileSync doesn't go through a shell, and on Windows pnpm is a
  // .cmd/.ps1 script rather than a binary, so the bare command name fails.
  const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  execFileSync(pnpmCmd, ['--filter', 'api', 'run', 'db:migrate'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, APP_ENV: 'test' },
  })
}
