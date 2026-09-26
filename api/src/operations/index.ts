import { commentOperations } from '#operations/comment'

export { commentOperations }
export const operations = [...commentOperations] as const
export type OperationRoutes = (typeof operations)[number]['routes'][number]
export type { AllRoutes } from '#operations/route-types'
export type {
  CliOutput,
  OperationClient,
  OperationDefinition,
  OperationError,
  OperationKind,
} from '#operations/types'
