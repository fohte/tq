// tsup inlines `process.env.TQ_ORIGIN` at build time (see tsup.config.ts), so
// the packaged app carries no environment lookup of its own.
const explicitOrigin = process.env['TQ_ORIGIN']
if (explicitOrigin === undefined || explicitOrigin === '') {
  // eslint-disable-next-line no-restricted-syntax -- module-eval-time boundary before any Result consumer exists, matching extension/src/config.ts
  throw new Error('TQ_ORIGIN environment variable is required')
}

if (!/^https?:\/\//.test(explicitOrigin)) {
  // eslint-disable-next-line no-restricted-syntax -- module-eval-time boundary before any Result consumer exists, matching extension/src/config.ts
  throw new Error(
    `TQ_ORIGIN must start with http:// or https://, e.g. https://tq.example.com (got: ${explicitOrigin})`,
  )
}

export const TQ_ORIGIN: string = explicitOrigin

// Comma-separated URL schemes without the colon (e.g. `myapp,otherapp`) that
// tq pages may hand to the OS, such as the scheme behind the session
// focus/resume URL templates. Beyond http(s) and mailto, only these are
// opened; every other scheme is blocked.
export const EXTERNAL_SCHEMES: readonly string[] = (
  process.env['TQ_EXTERNAL_SCHEMES'] ?? ''
)
  .split(',')
  .map((scheme) => scheme.trim().toLowerCase())
  .filter((scheme) => scheme !== '')
