import { taskReadOperations } from 'api/operations'
import type { Command } from 'commander'

import {
  registerTaskCompleteCommand,
  registerTaskCreateCommand,
  registerTaskDeleteCommand,
  registerTaskFromGithubCommand,
  registerTaskParentCommand,
  registerTaskStatusCommand,
  registerTaskUpdateCommand,
} from '#commands/task-write'
import type { ReadableStdin } from '#input'
import { registerOperationsInGroup } from '#operation-adapter'

export function registerTaskCommands(
  program: Command,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin,
): void {
  const task = program.command('task').description('Manage tasks')

  registerOperationsInGroup(task, taskReadOperations, fetchImpl, stdin)
  registerTaskCreateCommand(task, fetchImpl)
  registerTaskUpdateCommand(task, fetchImpl)
  registerTaskDeleteCommand(task, fetchImpl)
  registerTaskStatusCommand(task, fetchImpl)
  registerTaskParentCommand(task, fetchImpl)
  registerTaskCompleteCommand(task, fetchImpl)
  registerTaskFromGithubCommand(task, fetchImpl)
}
