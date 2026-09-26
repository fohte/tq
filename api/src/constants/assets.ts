// Pure constants module (no db/r2 side-effect imports) so the web package can
// import it without pulling in server-only dependencies.
export const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const

export const MAX_SIZE_BYTES = 10 * 1024 * 1024
