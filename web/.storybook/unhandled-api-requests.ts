// Shared between preview.tsx (which observes MSW's onUnhandledRequest) and
// vitest.setup.ts (which asserts on it) so a story hitting an /api/ endpoint
// with no MSW handler fails its test instead of silently rendering an MSW
// error response.
export const unhandledApiRequestUrls: string[] = []
