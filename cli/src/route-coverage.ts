import type { AllRoutes, OperationRoutes } from 'api/operations'

export type { AllRoutes }

export const EXCLUDED_ROUTES = {
  // Written by `tq hook` (the Claude Code hook integration). Bulk session
  // browsing (`tq session list`) is covered; single-session lookup and
  // custom-label editing remain web UI actions.
  'GET /api/agent-sessions/:id': 'session browsing is covered by the web UI',
  'GET /api/agent-sessions/:id/tasks':
    'session browsing is covered by the web UI',
  'PATCH /api/agent-sessions/:id': 'custom label editing is a web UI action',

  // OAuth callbacks are a browser/server contract, not something a CLI invokes.
  'GET /api/calendar/oauth-callback': 'oauth callback: browser/server contract',
  'GET /api/github/oauth-callback': 'oauth callback: browser/server contract',

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
  'PUT /api/calendar/accounts/:accountId/calendars/:calendarId/context':
    'calendar subscription setup requires browser authorization; one-time setup',

  // Settings screens the web UI already covers.
  'GET /api/scheduling-settings': 'settings covered by the web UI',
  'PATCH /api/scheduling-settings': 'settings covered by the web UI',
  'POST /api/github/sync-rules': 'settings covered by the web UI',
  'GET /api/github/sync-rules': 'settings covered by the web UI',
  'PATCH /api/github/sync-rules/:id': 'settings covered by the web UI',
  'DELETE /api/github/sync-rules/:id': 'settings covered by the web UI',
  'POST /api/recurring-task-templates': 'settings covered by the web UI',
  'GET /api/recurring-task-templates': 'settings covered by the web UI',
  'GET /api/recurring-task-templates/:id': 'settings covered by the web UI',
  'PATCH /api/recurring-task-templates/:id': 'settings covered by the web UI',
  'DELETE /api/recurring-task-templates/:id': 'settings covered by the web UI',

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

  // Web Push subscriptions belong to a browser: only a browser can produce
  // one, and only a browser can display what gets delivered to it.
  'GET /api/push/vapid-public-key': 'web push is a browser-only capability',
  'POST /api/push/subscriptions': 'web push is a browser-only capability',
  'DELETE /api/push/subscriptions': 'web push is a browser-only capability',
  'POST /api/push/test': 'web push is a browser-only capability',

  // Not a REST resource: a JSON-RPC/MCP transport endpoint, not a CLI concern.
  'ALL /api/mcp': 'MCP transport endpoint, not a REST resource',

  // DB-only variant of resolve for the browser extension's high-frequency
  // polling (every GitHub issue/PR page view); `tq github resolve` already
  // covers the CLI's occasional lookup use case via POST /api/github/resolve.
  'GET /api/github/link': "not a CLI concern; covered by 'tq github resolve'",

  // Autocomplete backends for the web editor's search bar and `#` mention
  // picker; they return canned/UI-shaped data, not task data a CLI use case
  // would want on its own.
  'GET /api/tasks/search/suggest':
    'backs the web search bar autocomplete, not a CLI concern',
  'GET /api/tasks/mentions':
    "backs the editor's # mention autocomplete, not a CLI concern",

  // Backs the web project detail page's task tree (ids only, no task data);
  // `GET /api/projects/:id` already covers a CLI's project-summary use case.
  'GET /api/projects/:id/task-ids':
    'backs the web project detail page, not a CLI concern',
} as const satisfies Partial<Record<AllRoutes, string>>

type ExcludedRoutes = keyof typeof EXCLUDED_ROUTES

type AssertNever<T extends never> = T

/**
 * Compile error if any API route is neither implemented nor excluded — the
 * mechanism that keeps the CLI from silently falling behind the API.
 */
export type UnclassifiedRoutes = Exclude<
  AllRoutes,
  OperationRoutes | ExcludedRoutes
>
export type _AssertAllRoutesClassified = AssertNever<UnclassifiedRoutes>

/**
 * Operation-backed and excluded routes must be disjoint.
 */
export type _AssertCoveredExcludedDisjoint = AssertNever<
  Extract<OperationRoutes, ExcludedRoutes>
>
