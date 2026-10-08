import { isTaskIdentifier } from 'api/lib/task-identifier'
import type { InferResponseType } from 'hono/client'

import { api } from '#lib/api'

type TaskPreview = InferResponseType<
  typeof api.api.tasks.preview.$get,
  200
>[string]

const MAX_BATCH_SIZE = 100
type TaskPreviewResponse = Record<string, TaskPreview>
type FetchPreviews = (ids: string[]) => Promise<TaskPreviewResponse>

type PendingRequest = {
  resolve: (preview: TaskPreview | null) => void
  reject: (error: unknown) => void
}

function fetchTaskPreviews(ids: string[]): Promise<TaskPreviewResponse> {
  return api.api.tasks.preview
    .$get({
      query: { ids: ids.join(',') },
    })
    .then((res) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime validation and middleware failures can still return non-2xx responses.
      return res.ok ? res.json() : {}
    })
}

function createTaskPreviewBatcher(fetchPreviews: FetchPreviews) {
  let pendingRequests = new Map<string, PendingRequest[]>()
  let flushScheduled = false

  function fetchBatch(requests: Map<string, PendingRequest[]>, ids: string[]) {
    return fetchPreviews(ids)
      .then((previews) => {
        for (const id of ids) {
          const preview = previews[id] ?? null
          requests.get(id)?.forEach(({ resolve }) => {
            resolve(preview)
          })
        }
      })
      .catch((error: unknown) => {
        for (const id of ids) {
          requests.get(id)?.forEach(({ reject }) => {
            reject(error)
          })
        }
      })
  }

  function flushRequests() {
    flushScheduled = false
    const requests = pendingRequests
    pendingRequests = new Map()

    const ids = [...requests.keys()]
    for (let offset = 0; offset < ids.length; offset += MAX_BATCH_SIZE) {
      void fetchBatch(requests, ids.slice(offset, offset + MAX_BATCH_SIZE))
    }
  }

  return (id: string): Promise<TaskPreview | null> => {
    if (!isTaskIdentifier(id)) return Promise.resolve(null)

    return new Promise((resolve, reject) => {
      const current = pendingRequests.get(id) ?? []
      current.push({ resolve, reject })
      pendingRequests.set(id, current)

      if (!flushScheduled) {
        flushScheduled = true
        queueMicrotask(flushRequests)
      }
    })
  }
}

export const getTaskPreview = createTaskPreviewBatcher(fetchTaskPreviews)
