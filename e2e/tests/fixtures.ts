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
    for (const id of ids) {
      await request.delete(`/api/tasks/${id}`)
    }
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
