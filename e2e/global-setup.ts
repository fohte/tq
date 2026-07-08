import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

export default function globalSetup(): void {
  // On Windows, pnpm is a .cmd script rather than a binary, and since
  // CVE-2024-27980 Node refuses to spawn .cmd/.bat files without shell:
  // true (EINVAL). All args here are fixed literals, so shell:true carries
  // no injection risk.
  const isWindows = process.platform === 'win32'
  execFileSync(
    isWindows ? 'pnpm.cmd' : 'pnpm',
    ['--filter', 'api', 'run', 'db:migrate'],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env, APP_ENV: 'test' },
      shell: isWindows,
    },
  )
}
