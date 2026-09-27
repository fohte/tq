import { calendarOperations } from 'api/operations'
import type { Command } from 'commander'

import type { ReadableStdin } from '#input'
import { registerOperations } from '#operation-adapter'

export function registerCalendarCommands(
  program: Command,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin,
): void {
  registerOperations(
    program,
    calendarOperations,
    'Manage calendar events',
    fetchImpl,
    stdin,
  )
}
