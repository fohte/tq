import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MemoWindowProps } from '#components/memo/memo-window'
import { makeMemo } from '#hooks/memo-test-fixtures'
import type { Memo, MemoContext, SaveMemoInput } from '#hooks/use-memos'
import { Route as MemoRoute } from '#routes/memo'

interface MemoQueryResult {
  data: Memo | undefined
  isPending: boolean
  isError: boolean
}

interface UpdateMemoVariables {
  context: MemoContext
  input: SaveMemoInput
}

interface UpdateMemoHook {
  mutateAsync: (variables: UpdateMemoVariables) => Promise<Memo>
}

const mocks = vi.hoisted(() => ({
  useCurrentContext: vi.fn<() => MemoContext>(),
  useMemos:
    vi.fn<
      (context: MemoContext, isCompactLayout: boolean) => MemoQueryResult
    >(),
  useUpdateMemo: vi.fn<() => UpdateMemoHook>(),
  mutateAsync: vi.fn<(variables: UpdateMemoVariables) => Promise<Memo>>(),
}))

vi.mock('#hooks/use-current-context', () => ({
  useCurrentContext: mocks.useCurrentContext,
}))

vi.mock('#hooks/use-memos', () => ({
  useMemos: mocks.useMemos,
  useUpdateMemo: mocks.useUpdateMemo,
}))

vi.mock('#components/memo/memo-window', () => ({
  MemoWindow: ({
    context,
    memo,
    isLoading,
    loadError,
    onSave,
  }: MemoWindowProps) => (
    <section>
      <span data-testid="context">{context}</span>
      <span data-testid="memo-content">{memo?.content}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="load-error">{String(loadError)}</span>
      <button
        onClick={() =>
          void onSave({
            content: 'Draft memo',
            revision: 4,
            readCurrentDraft: () => 'Current draft',
          })
        }
      >
        save memo
      </button>
    </section>
  ),
}))

// File routes are normally wired by routeTree.gen.ts; reproduce its runtime
// parent and ID so the test exercises the real route component.
const rootRoute = createRootRoute()
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-type-assertion -- mirrors routeTree.gen.ts when wiring file routes
MemoRoute.update({
  id: '/memo',
  path: '/memo',
  getParentRoute: () => rootRoute,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors routeTree.gen.ts when wiring file routes
} as any)
const routeTree = rootRoute.addChildren([MemoRoute])

async function renderMemoRoute() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/memo?layout=compact'] }),
  })
  await router.load()
  return render(<RouterProvider router={router} />)
}

function memoRouteState(
  saveCalls: {
    context: MemoContext
    input: { content: string; revision: number; currentDraft: string }
  }[],
) {
  return {
    rendered: {
      context: screen.getByTestId('context').textContent,
      memo: screen.getByTestId('memo-content').textContent,
      isLoading: screen.getByTestId('loading').textContent,
      loadError: screen.getByTestId('load-error').textContent,
    },
    queryCalls: mocks.useMemos.mock.calls,
    saveCalls,
  }
}

describe('MemoRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useCurrentContext.mockReturnValue('personal')
    mocks.useMemos.mockReturnValue({
      data: makeMemo({
        context: 'personal',
        content: 'Personal memo',
        revision: 4,
      }),
      isPending: false,
      isError: false,
    })
    mocks.mutateAsync.mockResolvedValue(
      makeMemo({ context: 'personal', content: 'Draft memo', revision: 5 }),
    )
    mocks.useUpdateMemo.mockReturnValue({ mutateAsync: mocks.mutateAsync })
  })

  it('loads and saves the memo for the active context in compact mode', async () => {
    const user = userEvent.setup()
    await renderMemoRoute()
    await user.click(screen.getByRole('button', { name: 'save memo' }))

    const saveCalls = mocks.mutateAsync.mock.calls.map(([variables]) => ({
      context: variables.context,
      input: {
        content: variables.input.content,
        revision: variables.input.revision,
        currentDraft: variables.input.readCurrentDraft(),
      },
    }))
    expect(memoRouteState(saveCalls)).toEqual({
      rendered: {
        context: 'personal',
        memo: 'Personal memo',
        isLoading: 'false',
        loadError: 'false',
      },
      queryCalls: [['personal', true]],
      saveCalls: [
        {
          context: 'personal',
          input: {
            content: 'Draft memo',
            revision: 4,
            currentDraft: 'Current draft',
          },
        },
      ],
    })
  })
})
