import type { AppType } from 'api/types'
import type { ExtractSchema } from 'hono/types'

type Schema = ExtractSchema<AppType>

/**
 * Every `${METHOD} ${path}` pair the API exposes, derived from the Hono app
 * type. Adding a route to `api/src/app.ts` grows this union, which is what
 * makes an unclassified route below a compile error instead of a silent gap.
 */
export type AllRoutes = {
  [Path in keyof Schema]: {
    [Method in keyof Schema[Path]]: Method extends `$${infer M}`
      ? `${Uppercase<M>} ${Path}`
      : never
  }[keyof Schema[Path]]
}[keyof Schema]

export const COVERED_ROUTES = [
  'GET /api/tasks/:taskId/pages',
  'POST /api/tasks/:taskId/pages',
  'GET /api/tasks/:taskId/pages/:pageId',
  'PATCH /api/tasks/:taskId/pages/:pageId',
  'DELETE /api/tasks/:taskId/pages/:pageId',

  // task
  'GET /api/tasks',
  'POST /api/tasks',
  'GET /api/tasks/:id',
  'PATCH /api/tasks/:id',
  'DELETE /api/tasks/:id',
  'PATCH /api/tasks/:id/status',
  'PATCH /api/tasks/:id/parent',
  'POST /api/tasks/:id/complete',
  'GET /api/tasks/:id/activity',
  'GET /api/tasks/tree',
  'GET /api/tasks/search',
  'POST /api/tasks/from-github',
] as const satisfies readonly AllRoutes[]

type CoveredRoutes = (typeof COVERED_ROUTES)[number]

export const EXCLUDED_ROUTES = {
  // OAuth callbacks are a browser/server contract, not something a CLI invokes.
  'GET /api/calendar/oauth-callback': 'oauth callback: browser/server contract',
  'GET /api/github/oauth-callback': 'oauth callback: browser/server contract',
  'GET /api/slack/oauth-callback': 'oauth callback: browser/server contract',

  // Integration connect/disconnect and calendar subscriptions require
  // browser-based OAuth authorization and are one-time setup.
  'GET /api/integrations':
    'integration setup requires browser authorization; one-time setup',
  'GET /api/integrations/:id/auth-url':
    'integration setup requires browser authorization; one-time setup',
  'DELETE /api/integrations/:id/accounts/:accountId':
    'integration setup requires browser authorization; one-time setup',
  'GET /api/calendar/accounts/:accountId/calendars':
    'calendar subscription setup requires browser authorization; one-time setup',
  'PUT /api/calendar/accounts/:accountId/calendars/:calendarId/subscription':
    'calendar subscription setup requires browser authorization; one-time setup',

  // Settings screens the web UI already covers.
  'GET /api/scheduling-settings': 'settings covered by the web UI',
  'PATCH /api/scheduling-settings': 'settings covered by the web UI',
  'POST /api/github/sync-rules': 'settings covered by the web UI',
  'GET /api/github/sync-rules': 'settings covered by the web UI',
  'PATCH /api/github/sync-rules/:id': 'settings covered by the web UI',
  'DELETE /api/github/sync-rules/:id': 'settings covered by the web UI',

  // Time blocks and recurring schedules are calendar-UI operations: faster
  // to drag/resize directly than to drive through a CLI.
  'POST /api/schedule/time-blocks':
    'calendar UI is faster for direct manipulation',
  'GET /api/schedule/time-blocks':
    'calendar UI is faster for direct manipulation',
  'PATCH /api/schedule/time-blocks/:id':
    'calendar UI is faster for direct manipulation',
  'DELETE /api/schedule/time-blocks/:id':
    'calendar UI is faster for direct manipulation',
  'POST /api/schedule/recurring':
    'calendar UI is faster for direct manipulation',
  'GET /api/schedule/recurring':
    'calendar UI is faster for direct manipulation',
  'PATCH /api/schedule/recurring/:id':
    'calendar UI is faster for direct manipulation',
  'DELETE /api/schedule/recurring/:id':
    'calendar UI is faster for direct manipulation',
  'POST /api/schedule/auto-assign':
    'calendar UI is faster for direct manipulation',

  // Not a REST resource: a JSON-RPC/MCP transport endpoint, not a CLI concern.
  'ALL /api/mcp': 'MCP transport endpoint, not a REST resource',

  // Autocomplete backends for the web editor's search bar and `#` mention
  // picker; they return canned/UI-shaped data, not task data a CLI use case
  // would want on its own.
  'GET /api/tasks/search/suggest':
    'backs the web search bar autocomplete, not a CLI concern',
  'GET /api/tasks/mentions':
    "backs the editor's # mention autocomplete, not a CLI concern",
} as const satisfies Partial<Record<AllRoutes, string>>

type ExcludedRoutes = keyof typeof EXCLUDED_ROUTES

/**
 * Routes with no CLI command yet. Remove an entry here once its command
 * ships; if the route is later found to be out of scope, move it to
 * `EXCLUDED_ROUTES` with a reason instead of deleting it silently.
 */
export const PENDING_ROUTES = [
  'GET /health',

  // comment
  'GET /api/tasks/:taskId/comments',
  'POST /api/tasks/:taskId/comments',
  'PATCH /api/tasks/:taskId/comments/:commentId',
  'DELETE /api/tasks/:taskId/comments/:commentId',

  // project
  'POST /api/projects',
  'GET /api/projects',
  'GET /api/projects/:id',
  'GET /api/projects/:id/tasks',
  'PATCH /api/projects/:id',
  'DELETE /api/projects/:id',

  // label
  'GET /api/labels',

  // image
  'POST /api/images',
  'GET /api/images/:id',
  'DELETE /api/images/:id',

  // github
  'POST /api/tasks/:taskId/github-link',
  'DELETE /api/tasks/:taskId/github-link',
  'POST /api/tasks/:taskId/github-link/sync',
  'POST /api/github/resolve',
  'POST /api/github/sync',

  // today
  'GET /api/schedule/today-tasks',
  'PUT /api/schedule/today-tasks',

  // calendar
  'GET /api/calendar/events',

  // slack
  'POST /api/slack/resolve',
] as const satisfies readonly AllRoutes[]

type PendingRoutes = (typeof PENDING_ROUTES)[number]

type AssertNever<T extends never> = T

/**
 * Compile error if any API route is neither implemented, excluded, nor
 * pending — the mechanism that keeps the CLI from silently falling behind
 * the API.
 */
export type UnclassifiedRoutes = Exclude<
  AllRoutes,
  CoveredRoutes | ExcludedRoutes | PendingRoutes
>
export type _AssertAllRoutesClassified = AssertNever<UnclassifiedRoutes>

/**
 * Coverage alone doesn't catch a route left in two tables at once (e.g. added
 * to `COVERED_ROUTES` on implementation without being removed from
 * `PENDING_ROUTES`) — these assert the three tables are pairwise disjoint.
 */
export type _AssertCoveredExcludedDisjoint = AssertNever<
  Extract<CoveredRoutes, ExcludedRoutes>
>
export type _AssertCoveredPendingDisjoint = AssertNever<
  Extract<CoveredRoutes, PendingRoutes>
>
export type _AssertExcludedPendingDisjoint = AssertNever<
  Extract<ExcludedRoutes, PendingRoutes>
>
