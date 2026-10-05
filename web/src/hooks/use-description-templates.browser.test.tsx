import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeDescriptionTemplate } from '#components/settings/description-template-test-fixtures'
import {
  useCreateDescriptionTemplate,
  useDeleteDescriptionTemplate,
  useDescriptionTemplates,
  useUpdateDescriptionTemplate,
} from '#hooks/use-description-templates'

vi.mock('#lib/api', () => {
  const getList = vi.fn()
  const create = vi.fn()
  const update = vi.fn()
  const remove = vi.fn()

  return {
    api: {
      api: {
        'description-templates': {
          $get: getList,
          $post: create,
          ':name': { $patch: update, $delete: remove },
        },
      },
    },
    __mocks: { getList, create, update, remove },
  }
})

interface ApiMocks {
  getList: Mock
  create: Mock
  update: Mock
  remove: Mock
}

async function getMocks(): Promise<ApiMocks> {
  const mod = await import('#lib/api')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- accessing test-only __mocks property injected by vi.mock
  const typed = mod as unknown as { __mocks: ApiMocks }
  return typed.__mocks
}

function getTemplateRequestCalls() {
  return {
    update: mocks.update.mock.calls,
    remove: mocks.remove.mock.calls,
  }
}

let queryClient: QueryClient
let mocks: ApiMocks

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) }
}

beforeEach(async () => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  mocks = await getMocks()
  mocks.getList.mockReset()
  mocks.create.mockReset()
  mocks.update.mockReset()
  mocks.remove.mockReset()
})

describe('useDescriptionTemplates', () => {
  it('returns the list response', async () => {
    const template = makeDescriptionTemplate()
    mocks.getList.mockResolvedValue(jsonResponse([template]))

    const { result } = renderHook(() => useDescriptionTemplates(), { wrapper })

    await waitFor(() => {
      expect(result.current.data).toEqual([template])
    })
  })

  it('does not request the list while disabled', () => {
    renderHook(() => useDescriptionTemplates({ enabled: false }), { wrapper })

    expect(mocks.getList.mock.calls).toEqual([])
  })

  it('encodes names for update and delete requests', async () => {
    const template = makeDescriptionTemplate({ name: 'Research/plan' })
    mocks.update.mockResolvedValue(jsonResponse(template))
    mocks.remove.mockResolvedValue({ ok: true, status: 204 })

    const update = renderHook(() => useUpdateDescriptionTemplate(), { wrapper })
    await act(async () => {
      await update.result.current.mutateAsync({
        name: template.name,
        input: { isDefault: false },
      })
    })

    const remove = renderHook(() => useDeleteDescriptionTemplate(), { wrapper })
    await act(async () => {
      await remove.result.current.mutateAsync(template.name)
    })

    expect(getTemplateRequestCalls()).toEqual({
      update: [
        [
          {
            param: { name: 'Research%2Fplan' },
            json: { isDefault: false },
          },
        ],
      ],
      remove: [[{ param: { name: 'Research%2Fplan' } }]],
    })
  })

  it('refetches the template list after each mutation', async () => {
    const template = makeDescriptionTemplate()
    const input = {
      name: template.name,
      whenToUse: template.whenToUse,
      body: template.body,
      guide: template.guide,
      isDefault: template.isDefault,
    }
    mocks.getList.mockResolvedValue(jsonResponse([template]))
    mocks.create.mockResolvedValue(jsonResponse(template))
    mocks.update.mockResolvedValue(jsonResponse(template))
    mocks.remove.mockResolvedValue({ ok: true, status: 204 })

    const list = renderHook(() => useDescriptionTemplates(), { wrapper })
    await waitFor(() => {
      expect(mocks.getList.mock.calls).toEqual([[]])
    })

    const create = renderHook(() => useCreateDescriptionTemplate(), { wrapper })
    await act(async () => {
      await create.result.current.mutateAsync(input)
    })
    await waitFor(() => {
      expect(mocks.getList.mock.calls).toEqual([[], []])
    })

    const update = renderHook(() => useUpdateDescriptionTemplate(), { wrapper })
    await act(async () => {
      await update.result.current.mutateAsync({
        name: template.name,
        input: { isDefault: false },
      })
    })
    await waitFor(() => {
      expect(mocks.getList.mock.calls).toEqual([[], [], []])
    })

    const remove = renderHook(() => useDeleteDescriptionTemplate(), { wrapper })
    await act(async () => {
      await remove.result.current.mutateAsync(template.name)
    })
    await waitFor(() => {
      expect(mocks.getList.mock.calls).toEqual([[], [], [], []])
    })
    list.unmount()
  })
})
