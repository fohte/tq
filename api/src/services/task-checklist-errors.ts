import { err } from 'neverthrow'

import { taskChecklistItems } from '#db/schema'

export type ChecklistError = { status: 400 | 404; message: string }
export type ChecklistItem = typeof taskChecklistItems.$inferSelect

export function fail<T>(status: ChecklistError['status'], message: string) {
  return err<T, ChecklistError>({ status, message })
}
