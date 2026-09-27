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
    taskWriteOperations.slice(0, 6),
    'Manage tasks',
    fetchImpl,
    stdin,
  )

  registerTaskActivityCommand(task, fetchImpl)
  registerTaskSearchCommand(task, fetchImpl)
  registerTaskSessionsCommand(task, fetchImpl)

  registerOperations(
    program,
    taskWriteOperations.slice(6),
    'Manage tasks',
    fetchImpl,
    stdin,
  )
}
