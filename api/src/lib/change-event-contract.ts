export const CHANGE_RESOURCES = [
  'task',
  'project',
  'label',
  'queue',
  'time_block',
  'schedule',
  'saved_view',
  'description_template',
  'recurring_task_template',
  'github_sync_rule',
  'agent_session',
  'checklist',
  'checklist_item',
  'scheduling_setting',
  'memo',
  'push',
  'calendar',
  'github',
  'asset',
  'integration',
  'unknown',
] as const

export type ChangeResource = (typeof CHANGE_RESOURCES)[number]

export interface ChangeEvent {
  resource: ChangeResource
  id: string | null
  origin: string | null
  taskIds: string[] | null
}

const changeResourceSet: ReadonlySet<string> = new Set(CHANGE_RESOURCES)

export function isChangeResource(value: unknown): value is ChangeResource {
  return typeof value === 'string' && changeResourceSet.has(value)
}
