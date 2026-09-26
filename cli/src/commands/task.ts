import type { Command } from 'commander'

import {
  registerTaskActivityCommand,
  registerTaskGetCommand,
  registerTaskListCommand,
  registerTaskSearchCommand,
  registerTaskSessionsCommand,
  registerTaskUrlCommand,
} from '#commands/task-read'
import {
  registerTaskCompleteCommand,
  registerTaskCreateCommand,
  registerTaskDeleteCommand,
  registerTaskFromGithubCommand,
  registerTaskParentCommand,
  registerTaskStatusCommand,
  registerTaskUpdateCommand,
} from '#commands/task-write'

export function registerTaskCommands(
  program: Command,
  fetchImpl: typeof fetch,
): void {
  const task = program.command('task').description('Manage tasks')

  registerTaskListCommand(task, fetchImpl)
  registerTaskGetCommand(task, fetchImpl)
  registerTaskUrlCommand(task)
  registerTaskCreateCommand(task, fetchImpl)
  registerTaskUpdateCommand(task, fetchImpl)
  registerTaskDeleteCommand(task, fetchImpl)
  registerTaskStatusCommand(task, fetchImpl)
  registerTaskParentCommand(task, fetchImpl)
  registerTaskCompleteCommand(task, fetchImpl)
  registerTaskActivityCommand(task, fetchImpl)
  registerTaskSearchCommand(task, fetchImpl)
  registerTaskSessionsCommand(task, fetchImpl)
  registerTaskFromGithubCommand(task, fetchImpl)
}
