import { taskWriteOperations } from 'api/operations'
import type { Command } from 'commander'

import {
  registerTaskActivityCommand,
  registerTaskGetCommand,
  registerTaskListCommand,
  registerTaskSearchCommand,
  registerTaskSessionsCommand,
  registerTaskUrlCommand,
} from '#commands/task-read'
import type { ReadableStdin } from '#input'
import { registerOperations } from '#operation-adapter'

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

  registerTaskListCommand(task, fetchImpl)
  registerTaskGetCommand(task, fetchImpl)
  registerTaskUrlCommand(task)

  registerOperations(
    program,
    taskWriteOperationsBeforeActivity,
    'Manage tasks',
    fetchImpl,
    stdin,
  )

  registerTaskActivityCommand(task, fetchImpl)
  registerTaskSearchCommand(task, fetchImpl)
  registerTaskSessionsCommand(task, fetchImpl)

  registerOperations(
    program,
    taskWriteOperationsAfterActivity,
    'Manage tasks',
    fetchImpl,
    stdin,
  )
}
