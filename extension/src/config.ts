// build.mjs replaces this with the TQ_ORIGIN env var (esbuild --define), so
// the value here is only ever seen when running outside that build (tests).
export const TQ_ORIGIN = process.env['TQ_ORIGIN'] ?? 'https://tq.fohte.net'
