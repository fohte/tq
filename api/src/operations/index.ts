import { commentOperations } from '#operations/comment'
import { labelOperations } from '#operations/label'
import { projectOperations } from '#operations/project'

export { commentOperations, labelOperations, projectOperations }
export const operations = [
  ...commentOperations,
  ...labelOperations,
  ...projectOperations,
] as const
export type OperationRoutes = (typeof operations)[number]['routes'][number]
export type { AllRoutes } from '#operations/route-types'
export type {
  CliOutput,
  OperationClient,
  OperationDefinition,
  OperationError,
  OperationKind,
} from '#operations/types'
