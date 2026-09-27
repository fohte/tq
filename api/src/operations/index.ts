import { calendarOperations } from '#operations/calendar'
import { commentOperations } from '#operations/comment'
import { githubOperations } from '#operations/github'
import { healthOperations } from '#operations/health'
import { hookOperations } from '#operations/hook'
import { imageOperations } from '#operations/image'
import { labelOperations } from '#operations/label'
import { linkOperations } from '#operations/link'
import { pageOperations } from '#operations/page'
import { projectOperations } from '#operations/project'
import { queueOperations } from '#operations/queue'
import { savedViewOperations } from '#operations/saved-view'
import { sessionOperations } from '#operations/session'
import { slackOperations } from '#operations/slack'
import { taskReadOperations } from '#operations/task-read'
import { taskWriteOperations } from '#operations/task-write'

export {
  calendarOperations,
  commentOperations,
  githubOperations,
  healthOperations,
  hookOperations,
  imageOperations,
  labelOperations,
  linkOperations,
  pageOperations,
  projectOperations,
  queueOperations,
  savedViewOperations,
  sessionOperations,
  slackOperations,
  taskReadOperations,
  taskWriteOperations,
}
export const operations = [
  ...calendarOperations,
  ...commentOperations,
  ...githubOperations,
  ...healthOperations,
  ...hookOperations,
  ...imageOperations,
  ...labelOperations,
  ...linkOperations,
  ...pageOperations,
  ...projectOperations,
  ...queueOperations,
  ...savedViewOperations,
  ...sessionOperations,
  ...slackOperations,
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
  CliFileOutput,
  CliOutput,
  OperationClient,
  OperationDefinition,
  OperationError,
  OperationKind,
  OperationSurface,
  PositionalArgument,
} from '#operations/types'
export { formatInputIssues } from '#operations/types'
