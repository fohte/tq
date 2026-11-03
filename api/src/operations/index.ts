import { assetOperations } from '#operations/asset'
import { calendarOperations } from '#operations/calendar'
import { checklistOperations } from '#operations/checklist'
import { commentOperations } from '#operations/comment'
import { descriptionTemplateOperations } from '#operations/description-template'
import { githubOperations } from '#operations/github'
import { healthOperations } from '#operations/health'
import { hookOperations } from '#operations/hook'
import { labelOperations } from '#operations/label'
import { linkOperations } from '#operations/link'
import { memoOperations } from '#operations/memo'
import { pageOperations } from '#operations/page'
import { prioritySettingsOperations } from '#operations/priority-settings'
import { projectOperations } from '#operations/project'
import { queueOperations } from '#operations/queue'
import { recurringTemplateOperations } from '#operations/recurring-template'
import { savedViewOperations } from '#operations/saved-view'
import { scheduleOperations } from '#operations/schedule'
import { scheduleConstraintOperations } from '#operations/schedule-constraints'
import { scheduleOverrideOperations } from '#operations/schedule-override'
import { sessionOperations } from '#operations/session'
import { taskReadOperations } from '#operations/task-read'
import { taskWriteOperations } from '#operations/task-write'
import { waitOperations } from '#operations/wait'
import { webhookOperations } from '#operations/webhook'

export {
  assetOperations,
  calendarOperations,
  checklistOperations,
  commentOperations,
  descriptionTemplateOperations,
  githubOperations,
  healthOperations,
  hookOperations,
  labelOperations,
  linkOperations,
  memoOperations,
  pageOperations,
  prioritySettingsOperations,
  projectOperations,
  queueOperations,
  recurringTemplateOperations,
  savedViewOperations,
  scheduleConstraintOperations,
  scheduleOperations,
  scheduleOverrideOperations,
  sessionOperations,
  taskReadOperations,
  taskWriteOperations,
  waitOperations,
  webhookOperations,
}
export const operations = [
  ...assetOperations,
  ...calendarOperations,
  ...checklistOperations,
  ...commentOperations,
  ...descriptionTemplateOperations,
  ...githubOperations,
  ...healthOperations,
  ...hookOperations,
  ...labelOperations,
  ...linkOperations,
  ...memoOperations,
  ...pageOperations,
  ...prioritySettingsOperations,
  ...projectOperations,
  ...queueOperations,
  ...recurringTemplateOperations,
  ...savedViewOperations,
  ...scheduleOperations,
  ...scheduleConstraintOperations,
  ...scheduleOverrideOperations,
  ...sessionOperations,
  ...taskReadOperations,
  ...taskWriteOperations,
  ...waitOperations,
  ...webhookOperations,
] as const

type CliOperation<Operation> = Operation extends {
  surface: { only: 'mcp'; reason: string }
}
  ? never
  : Operation

export type OperationRoutes = CliOperation<
  (typeof operations)[number]
>['routes'][number]
export type { AllRoutes } from '#operations/route-types'
export type {
  CliContentInput,
  CliFileInput,
  CliFileOutput,
  CliOutput,
  OperationClient,
  OperationDefinition,
  OperationError,
  OperationKind,
  OperationSurface,
  PositionalArgument,
} from '#operations/types'
export { formatInputIssues, omitKeyRecursively } from '#operations/types'
