import type { Context, MiddlewareHandler } from 'hono'
import { routePath } from 'hono/route'

import type { ChangeEvent, ChangeResource } from '#lib/change-event-contract'

export type { ChangeEvent } from '#lib/change-event-contract'

type ChangeEventListener = (event: ChangeEvent) => void

const listeners = new Set<ChangeEventListener>()

const routeResources: Record<string, ChangeResource> = {
  tasks: 'task',
  projects: 'project',
  labels: 'label',
  queues: 'queue',
  'agent-sessions': 'agent_session',
  'checklist-items': 'checklist_item',
  checklists: 'checklist',
  'recurring-task-templates': 'recurring_task_template',
  'description-templates': 'description_template',
  'saved-views': 'saved_view',
  'scheduling-settings': 'scheduling_setting',
  memos: 'memo',
  push: 'push',
  calendar: 'calendar',
  github: 'github',
  assets: 'asset',
  integrations: 'integration',
}

// React Query uses these POST routes for reads or syncs; sync writes publish targeted events separately.
const postQueryRoutes = new Set([
  '/api/github/resolve',
  '/api/github/sync',
  '/api/tasks/:taskId/github-link/sync',
])

export function subscribeToChangeEvents(
  listener: ChangeEventListener,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function publishChangeEvent(event: ChangeEvent): void {
  for (const listener of listeners) {
    listener(event)
  }
}

function resourceFromRoute(routePattern: string): ChangeResource | null {
  const segments = routePattern.split('/').filter(Boolean)
  if (segments[0] !== 'api' || segments[1] == null || segments[1] === 'mcp') {
    return null
  }

  const rootResource = segments[1]
  if (rootResource === 'schedule') {
    return ['time-blocks', 'auto-assign'].includes(segments[2] ?? '')
      ? 'time_block'
      : 'schedule'
  }
  if (rootResource === 'github' && segments[2] === 'sync-rules') {
    return 'github_sync_rule'
  }

  return routeResources[rootResource] ?? 'unknown'
}

function idFromRoute(routePattern: string, c: Context) {
  const paramName = routePattern
    .split('/')
    .find((segment) => segment.startsWith(':'))
    ?.slice(1)

  return paramName == null ? null : (c.req.param(paramName) ?? null)
}

export const changeEventMiddleware: MiddlewareHandler = async (c, next) => {
  const path = c.req.path
  if (
    c.req.method === 'GET' ||
    path === '/api/mcp' ||
    path.startsWith('/api/mcp/')
  ) {
    return next()
  }

  await next()

  if (c.res.status < 200 || c.res.status >= 300) return

  const routePattern = routePath(c, -1)
  if (postQueryRoutes.has(routePattern)) return

  const resource = resourceFromRoute(routePattern)
  if (resource == null) return

  publishChangeEvent({
    resource,
    id: idFromRoute(routePattern, c),
    origin: c.get('origin'),
  })
}
