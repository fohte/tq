import { commentOperations } from '#operations/comment'
import { projectOperations } from '#operations/project'

export { commentOperations, projectOperations }
export const operations = [...commentOperations, ...projectOperations] as const
export type OperationRoutes = (typeof operations)[number]['routes'][number]
export type { AllRoutes } from '#operations/route-types'
export type {
  CliOutput,
  OperationClient,
  OperationDefinition,
  OperationError,
  OperationKind,
} from '#operations/types'
