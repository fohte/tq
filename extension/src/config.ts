// build.mjs's esbuild --define replaces this reference before it reaches a
// real bundle, so only a build invoked without TQ_ORIGIN set (or a test run
// without it configured) can reach the throw below.
const explicitOrigin = process.env['TQ_ORIGIN']
if (explicitOrigin === undefined) {
  // eslint-disable-next-line no-restricted-syntax -- module-eval-time boundary before any Result consumer exists, matching api/src/env.ts
  throw new Error('TQ_ORIGIN environment variable is required')
}

export const TQ_ORIGIN: string = explicitOrigin
