import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeDescriptionTemplate } from '#components/settings/description-template-test-fixtures'
import {
  descriptionTemplateKeys,
  useCreateDescriptionTemplate,
  useDeleteDescriptionTemplate,
  useDescriptionTemplate,
  useDescriptionTemplates,
  useUpdateDescriptionTemplate,
} from '#hooks/use-description-templates'

vi.mock('#lib/api', () => {
  const getList = vi.fn()
  const getDetail = vi.fn()
  const create = vi.fn()
  const update = vi.fn()
  const remove = vi.fn()

  return {
    api: {
      api: {
        'description-templates': {
          $get: getList,
          $post: create,
          ':name': { $get: getDetail, $patch: update, $delete: remove },
        },
      },
    },
    __mocks: { getList, getDetail, create, update, remove },
  }
})

interface ApiMocks {
  getList: Mock
  getDetail: Mock
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
    detail: mocks.getDetail.mock.calls,
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
  mocks.getDetail.mockReset()
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

  it('returns the template for a name', async () => {
    const template = makeDescriptionTemplate()
    mocks.getDetail.mockResolvedValue(jsonResponse(template))

    const { result } = renderHook(() => useDescriptionTemplate(template.name), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.data).toEqual(template)
    })
  })

  it('encodes names for detail, update, and delete requests', async () => {
    const template = makeDescriptionTemplate({ name: 'Research/plan' })
    mocks.getDetail.mockResolvedValue(jsonResponse(template))
    mocks.update.mockResolvedValue(jsonResponse(template))
    mocks.remove.mockResolvedValue({ ok: true, status: 204 })

    const detail = renderHook(() => useDescriptionTemplate(template.name), {
      wrapper,
    })
    await waitFor(() => {
      expect(detail.result.current.data).toEqual(template)
    })
    detail.unmount()

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
      detail: [[{ param: { name: 'Research%2Fplan' } }]],
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

  it('invalidates the shared query key after each mutation', async () => {
    const template = makeDescriptionTemplate()
    const input = {
      name: template.name,
      whenToUse: template.whenToUse,
      body: template.body,
      guide: template.guide,
      isDefault: template.isDefault,
    }
    const expectedInvalidation = { queryKey: descriptionTemplateKeys.all }
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    mocks.create.mockResolvedValue(jsonResponse(template))
    mocks.update.mockResolvedValue(jsonResponse(template))
    mocks.remove.mockResolvedValue({ ok: true, status: 204 })

    const create = renderHook(() => useCreateDescriptionTemplate(), { wrapper })
    await act(async () => {
      await create.result.current.mutateAsync(input)
    })

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

    expect(invalidateQueries.mock.calls).toEqual([
      [expectedInvalidation],
      [expectedInvalidation],
      [expectedInvalidation],
    ])
  })
})
