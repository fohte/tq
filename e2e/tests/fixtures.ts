import { test as base } from '@playwright/test'

export interface ApiTask {
  id: string
  title: string
  [key: string]: unknown
}

interface Fixtures {
  /** Registers a task id (however it was created) for deletion after the test. */
  trackTaskId: (id: string) => void
  /** Creates a task directly via the API and tracks it for cleanup. */
  createTask: (input: Record<string, unknown>) => Promise<ApiTask>
}

export const test = base.extend<Fixtures>({
  trackTaskId: async ({ request }, use) => {
    const ids: string[] = []
    await use((id) => {
      ids.push(id)
    })
    // allSettled: one failed delete must not abandon cleanup of the rest,
    // since there's no per-test transaction rollback to fall back on.
    await Promise.allSettled(
      ids.map((id) => request.delete(`/api/tasks/${id}`)),
    )
  },
  createTask: async ({ request, trackTaskId }, use) => {
    await use(async (input) => {
      const res = await request.post('/api/tasks', { data: input })
      if (!res.ok()) {
        throw new Error(`Failed to create task: ${String(res.status())}`)
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test-only response shape, not runtime-validated
      const task = (await res.json()) as ApiTask
      trackTaskId(task.id)
      return task
    })
  },
})

export { expect } from '@playwright/test'

export function uniqueTitle(prefix: string): string {
  return `${prefix} ${crypto.randomUUID().slice(0, 8)}`
}

export function todayStr(): string {
  const d = new Date()
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
