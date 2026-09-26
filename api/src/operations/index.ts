import { commentOperations } from '#operations/comment'

export { commentOperations }
export const operations = [...commentOperations] as const

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
