import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeGithubLink } from '#components/task/github-link-test-fixtures'
import { makeTaskDetail } from '#components/task/task-row-test-fixtures'
import type { GithubLink } from '#hooks/use-github-link'
import { useUpdateGithubLinkNotifyEvents } from '#hooks/use-github-link'
import type { TaskDetail } from '#hooks/use-tasks'
import { taskKeys } from '#hooks/use-tasks'
import { assertDefined } from '#lib/test-utils'

vi.mock('#lib/api', () => {
  const mockPatch = vi.fn()

  return {
    api: {
      api: {
        tasks: {
          ':taskId': {
            'github-link': {
              ':linkId': { $patch: mockPatch },
            },
          },
        },
      },
    },
    __mocks: { mockPatch },
  }
})

async function getMocks() {
  const mod = await import('#lib/api')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- accessing test-only __mocks property injected by vi.mock
  const typed = mod as unknown as {
    __mocks: Record<string, ReturnType<typeof vi.fn>>
  }
  return typed.__mocks
}

const taskId = 'task-example'
const targetLink = makeGithubLink({
  id: 'link-target',
  owner: 'example-owner',
  repo: 'example-repo',
  number: 7319,
  url: 'https://github.com/example-owner/example-repo/issues/7319',
  title: 'An example issue',
  notifyEvents: ['closed'],
})
const otherLink = makeGithubLink({
  id: 'link-other',
  owner: 'example-owner',
  repo: 'another-example-repo',
  number: 8421,
  kind: 'pull_request',
  role: 'blocker',
  url: 'https://github.com/example-owner/another-example-repo/pull/8421',
  title: 'Another example pull request',
  notifyEvents: ['closed'],
})

function makeDetail(): TaskDetail {
  return makeTaskDetail({
    id: taskId,
    title: 'An example task',
    githubLinks: [targetLink],
    githubBlockers: [otherLink],
  })
}

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function readPendingMutationState(
  mockPatch: ReturnType<typeof vi.fn>,
  isPending: boolean,
) {
  return {
    cache: queryClient.getQueryData(taskKeys.detail(taskId)),
    patchCalls: mockPatch.mock.calls,
    isPending,
  }
}

function readMutationOutcome(
  mockPatch: ReturnType<typeof vi.fn>,
  outcome: 'resolved' | 'rejected',
) {
  return {
    outcome,
    cache: queryClient.getQueryData(taskKeys.detail(taskId)),
    patchCalls: mockPatch.mock.calls,
  }
}

beforeEach(async () => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const mocks = await getMocks()
  for (const mock of Object.values(mocks)) {
    mock.mockReset()
  }
})

afterEach(() => {
  queryClient.clear()
})

describe('useUpdateGithubLinkNotifyEvents', () => {
  it('optimistically updates the selected blocker while the PATCH is pending', async () => {
    const mocks = await getMocks()
    const previousDetail = makeDetail()
    const nextEvents: GithubLink['notifyEvents'] = ['closed', 'comments']
    const optimisticDetail = {
      ...previousDetail,
      githubBlockers: previousDetail.githubBlockers.map((blocker) =>
        blocker.id === otherLink.id
          ? { ...blocker, notifyEvents: nextEvents }
          : blocker,
      ),
    }
    queryClient.setQueryData(taskKeys.detail(taskId), previousDetail)

    let resolvePatch: (value: unknown) => void = () => {
      throw new Error('resolvePatch called before the PATCH request starts')
    }
    const patchResponsePromise = new Promise((resolve) => {
      resolvePatch = resolve
    })
    assertDefined(mocks['mockPatch']).mockReturnValue(patchResponsePromise)

    const { result } = renderHook(
      () => useUpdateGithubLinkNotifyEvents(taskId),
      { wrapper },
    )
    let mutationPromise: Promise<GithubLink> | undefined
    act(() => {
      mutationPromise = result.current.mutateAsync({
        linkId: otherLink.id,
        notifyEvents: nextEvents,
      })
    })

    await waitFor(() => {
      expect(
        readPendingMutationState(
          assertDefined(mocks['mockPatch']),
          result.current.isPending,
        ),
      ).toEqual({
        cache: optimisticDetail,
        patchCalls: [
          [
            {
              param: { taskId, linkId: otherLink.id },
              json: { notifyEvents: nextEvents },
            },
          ],
        ],
        isPending: true,
      })
    })

    resolvePatch({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ ...otherLink, notifyEvents: nextEvents }),
    })
    await assertDefined(mutationPromise)
  })

  it('optimistically updates an ordinary GitHub link while the PATCH is pending', async () => {
    const mocks = await getMocks()
    const previousDetail = makeDetail()
    const nextEvents: GithubLink['notifyEvents'] = ['closed', 'comments']
    const optimisticDetail = {
      ...previousDetail,
      githubLinks: previousDetail.githubLinks.map((link) =>
        link.id === targetLink.id
          ? { ...link, notifyEvents: nextEvents }
          : link,
      ),
    }
    queryClient.setQueryData(taskKeys.detail(taskId), previousDetail)

    let resolvePatch: (value: unknown) => void = () => {
      throw new Error('resolvePatch called before the PATCH request starts')
    }
    const patchResponsePromise = new Promise((resolve) => {
      resolvePatch = resolve
    })
    assertDefined(mocks['mockPatch']).mockReturnValue(patchResponsePromise)

    const { result } = renderHook(
      () => useUpdateGithubLinkNotifyEvents(taskId),
      { wrapper },
    )
    let mutationPromise: Promise<GithubLink> | undefined
    act(() => {
      mutationPromise = result.current.mutateAsync({
        linkId: targetLink.id,
        notifyEvents: nextEvents,
      })
    })

    await waitFor(() => {
      expect(
        readPendingMutationState(
          assertDefined(mocks['mockPatch']),
          result.current.isPending,
        ),
      ).toEqual({
        cache: optimisticDetail,
        patchCalls: [
          [
            {
              param: { taskId, linkId: targetLink.id },
              json: { notifyEvents: nextEvents },
            },
          ],
        ],
        isPending: true,
      })
    })

    resolvePatch({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ ...targetLink, notifyEvents: nextEvents }),
    })
    await assertDefined(mutationPromise)
  })

  it('restores the previous task detail when the PATCH fails', async () => {
    const mocks = await getMocks()
    const previousDetail = makeDetail()
    const nextEvents: GithubLink['notifyEvents'] = ['closed', 'comments']
    queryClient.setQueryData(taskKeys.detail(taskId), previousDetail)
    assertDefined(mocks['mockPatch']).mockResolvedValue({
      status: 500,
      ok: false,
      json: () => Promise.resolve({ error: 'Example failure' }),
    })

    const { result } = renderHook(
      () => useUpdateGithubLinkNotifyEvents(taskId),
      { wrapper },
    )
    let mutationOutcome: Promise<'resolved' | 'rejected'> | undefined
    act(() => {
      mutationOutcome = result.current
        .mutateAsync({ linkId: otherLink.id, notifyEvents: nextEvents })
        .then(
          () => 'resolved' as const,
          () => 'rejected' as const,
        )
    })
    const outcome = await assertDefined(mutationOutcome)

    expect(
      readMutationOutcome(assertDefined(mocks['mockPatch']), outcome),
    ).toEqual({
      outcome: 'rejected',
      cache: previousDetail,
      patchCalls: [
        [
          {
            param: { taskId, linkId: otherLink.id },
            json: { notifyEvents: nextEvents },
          },
        ],
      ],
    })
  })
})
