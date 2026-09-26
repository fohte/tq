import { commentOperations } from '#operations/comment'
import { labelOperations } from '#operations/label'

export { commentOperations, labelOperations }
export const operations = [...commentOperations, ...labelOperations] as const
export type OperationRoutes = (typeof operations)[number]['routes'][number]
export type { AllRoutes } from '#operations/route-types'
export type {
  CliOutput,
  OperationClient,
  OperationDefinition,
  OperationError,
  OperationKind,
} from '#operations/types'
