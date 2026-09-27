import { taskReadOperations, taskWriteOperations } from 'api/operations'
import type { Command } from 'commander'

import type { ReadableStdin } from '#input'
import { registerOperationsInGroup } from '#operation-adapter'

const taskReadOperationsBeforeWrite = taskReadOperations.filter(
  (operation) =>
    operation.path[1] === 'list' ||
    operation.path[1] === 'get' ||
    operation.path[1] === 'url',
)
const taskReadOperationsAfterWrite = taskReadOperations.filter(
  (operation) =>
    operation.path[1] === 'activity' ||
    operation.path[1] === 'search' ||
    operation.path[1] === 'sessions',
)
const taskWriteOperationsBeforeActivity = taskWriteOperations.filter(
  (operation) => operation.path[1] !== 'from-github',
)
const taskWriteOperationsAfterActivity = taskWriteOperations.filter(
  (operation) => operation.path[1] === 'from-github',
)

export function registerTaskCommands(
  program: Command,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin,
): void {
  const task = program.command('task').description('Manage tasks')

  registerOperationsInGroup(
    task,
    taskReadOperationsBeforeWrite,
    fetchImpl,
    stdin,
  )
  registerOperationsInGroup(
    task,
    taskWriteOperationsBeforeActivity,
    fetchImpl,
    stdin,
  )
  registerOperationsInGroup(
    task,
    taskReadOperationsAfterWrite,
    fetchImpl,
    stdin,
  )
  registerOperationsInGroup(
    task,
    taskWriteOperationsAfterActivity,
    fetchImpl,
    stdin,
  )
}
