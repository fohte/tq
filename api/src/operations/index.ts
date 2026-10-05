import { assetOperations } from '#operations/asset'
import { calendarOperations } from '#operations/calendar'
import { commentOperations } from '#operations/comment'
import { descriptionTemplateOperations } from '#operations/description-template'
import { githubOperations } from '#operations/github'
import { healthOperations } from '#operations/health'
import { hookOperations } from '#operations/hook'
import { labelOperations } from '#operations/label'
import { linkOperations } from '#operations/link'
import { memoOperations } from '#operations/memo'
import { pageOperations } from '#operations/page'
import { projectOperations } from '#operations/project'
import { queueOperations } from '#operations/queue'
import { savedViewOperations } from '#operations/saved-view'
import { scheduleOperations } from '#operations/schedule'
import { scheduleOverrideOperations } from '#operations/schedule-override'
import { sessionOperations } from '#operations/session'
import { taskReadOperations } from '#operations/task-read'
import { taskWriteOperations } from '#operations/task-write'

export {
  assetOperations,
  calendarOperations,
  commentOperations,
  descriptionTemplateOperations,
  githubOperations,
  healthOperations,
  hookOperations,
  labelOperations,
  linkOperations,
  memoOperations,
  pageOperations,
  projectOperations,
  queueOperations,
  savedViewOperations,
  scheduleOperations,
  scheduleOverrideOperations,
  sessionOperations,
  taskReadOperations,
  taskWriteOperations,
}
export const operations = [
  ...assetOperations,
  ...calendarOperations,
  ...commentOperations,
  ...descriptionTemplateOperations,
  ...githubOperations,
  ...healthOperations,
  ...hookOperations,
  ...labelOperations,
  ...linkOperations,
  ...memoOperations,
  ...pageOperations,
  ...projectOperations,
  ...queueOperations,
  ...savedViewOperations,
  ...scheduleOperations,
  ...scheduleOverrideOperations,
  ...sessionOperations,
  ...taskReadOperations,
  ...taskWriteOperations,
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
