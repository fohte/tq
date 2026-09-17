const explicitOrigin = process.env['TQ_ORIGIN']
if (explicitOrigin === undefined || explicitOrigin === '') {
  // eslint-disable-next-line no-restricted-syntax -- module-eval-time boundary before any Result consumer exists, matching api/src/env.ts
  throw new Error('TQ_ORIGIN environment variable is required')
}

export const TQ_ORIGIN: string = explicitOrigin
