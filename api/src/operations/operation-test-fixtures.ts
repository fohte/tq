import { okAsync } from 'neverthrow'
import { z } from 'zod'

import type { OperationDefinition } from '#operations/types'

export function makeOperation(
  overrides: Partial<OperationDefinition> = {},
): OperationDefinition {
  return {
    path: ['demo', 'test'],
    description: 'Exercise operation adapter behavior.',
    inputSchema: z.object({}),
    positionalArgs: [],
    kind: 'read',
    routes: [],
    cli: { output: { kind: 'json' } },
    run: (_client, input) => okAsync(input),
    ...overrides,
  }
}
