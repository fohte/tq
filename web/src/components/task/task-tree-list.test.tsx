import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeNode } from '#components/task/task-row-test-fixtures'
import { TaskTreeList } from '#components/task/task-tree-list'
import type { TreeNode } from '#hooks/use-tasks'
import { atIndex } from '#lib/test-utils'

// LinkExistingTaskMenu/MoveUnderTaskMenu/SetProjectMenu/DeleteTaskDialog
// (rendered unconditionally by every row, controlled via their own `open`
// prop) also pull from this module. All dialogs start closed, so their
// queries stay disabled — these stubs only need to exist, not do anything.
vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-tasks')>()
  return {
    ...actual,
    useCompleteTask: () => ({ mutate: vi.fn() }),
    useUpdateTaskStatus: () => ({ mutate: vi.fn() }),
    useTaskList: () => ({ categorized: { all: [] } }),
    useUpdateTaskParent: () => ({ mutate: vi.fn() }),
    useUpdateTask: () => ({ mutate: vi.fn() }),
    useDeleteTask: () => ({ mutate: vi.fn() }),
  }
})

vi.mock('#hooks/use-projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-projects')>()
  return {
    ...actual,
    useProject: () => ({ data: undefined }),
  }
})

// The router's first route match resolves asynchronously even with no
// loaders, so router.load() is awaited before render() to avoid an initial
// blank paint (see https://tanstack.com/router/latest/docs/framework/react/guide/testing).
async function renderTaskTreeList(tree: TreeNode[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => (
      <TaskTreeList
        isLoading={false}
        tree={tree}
        tasks={[]}
        sessionsByTaskId={new Map()}
      />
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TaskTreeList', () => {
  it('indents deeper rows more than their ancestors', async () => {
    const grandchild = makeNode({
      id: 'grandchild-1',
      title: 'Grandchild Task',
    })
    const child = makeNode({
      id: 'child-1',
      title: 'Child Task',
      children: [grandchild],
      childCompletionCount: { completed: 0, total: 1 },
    })
    const root = makeNode({
      children: [child],
      childCompletionCount: { completed: 0, total: 1 },
    })
    await renderTaskTreeList([root])

    const rowIndentUnits = (text: string) => {
      const el = atIndex(screen.getAllByText(text), 0).closest(
        '[style*="--row-indent"]',
      )
      if (!(el instanceof HTMLElement)) {
        throw new Error(`Expected an element with --row-indent near "${text}"`)
      }
      const value = el.style.getPropertyValue('--row-indent')
      const match = /\d+/.exec(value)
      if (match == null) {
        throw new Error(`Unexpected --row-indent value: "${value}"`)
      }
      return Number.parseInt(match[0], 10)
    }

    const depths = [
      rowIndentUnits('Parent Task'),
      rowIndentUnits('Child Task'),
      rowIndentUnits('Grandchild Task'),
    ]

    expect(depths.every((px, i) => i === 0 || px > (depths[i - 1] ?? 0))).toBe(
      true,
    )
  })

  it('renders nested children (grandchildren) under their parent', async () => {
    const grandchild = makeNode({
      id: 'grandchild-1',
      title: 'Grandchild Task',
      parentId: 'child-1',
    })
    const child = makeNode({
      id: 'child-1',
      title: 'Child Task',
      parentId: 'parent-1',
      children: [grandchild],
      childCompletionCount: { completed: 0, total: 1 },
    })
    const root = makeNode({
      children: [child],
      childCompletionCount: { completed: 0, total: 1 },
    })
    await renderTaskTreeList([root])

    expect(screen.getByText('Parent Task')).toBeInTheDocument()
    expect(screen.getByText('Child Task')).toBeInTheDocument()
    expect(screen.getByText('Grandchild Task')).toBeInTheDocument()
  })

  it('collapses and re-expands a subtree when its toggle is clicked', async () => {
    const user = userEvent.setup()
    const child = makeNode({
      id: 'child-1',
      title: 'Child Task',
      parentId: 'parent-1',
    })
    const root = makeNode({
      children: [child],
      childCompletionCount: { completed: 0, total: 1 },
    })
    await renderTaskTreeList([root])

    expect(screen.getByText('Child Task')).toBeInTheDocument()

    await user.click(atIndex(screen.getAllByLabelText('Collapse'), 0))
    expect(screen.queryByText('Child Task')).not.toBeInTheDocument()

    await user.click(atIndex(screen.getAllByLabelText('Expand'), 0))
    expect(screen.getByText('Child Task')).toBeInTheDocument()
  })

  it("renders sibling roots in document order, skipping a collapsed root's subtree", async () => {
    const user = userEvent.setup()
    const middleChild = makeNode({
      id: 'middle-child',
      title: 'Middle Child Task',
      parentId: 'middle',
    })
    const first = makeNode({ id: 'first', number: 1, title: 'First Root' })
    const middle = makeNode({
      id: 'middle',
      number: 2,
      title: 'Middle Root',
      children: [middleChild],
      childCompletionCount: { completed: 0, total: 1 },
    })
    const last = makeNode({ id: 'last', number: 3, title: 'Last Root' })
    await renderTaskTreeList([first, middle, last])

    await user.click(atIndex(screen.getAllByLabelText('Collapse'), 0))
    expect(screen.queryByText('Middle Child Task')).not.toBeInTheDocument()

    const bodyText = document.body.textContent
    const order = ['First Root', 'Middle Root', 'Last Root'].map((title) =>
      bodyText.indexOf(title),
    )
    expect(order.every((pos, i) => i === 0 || pos > (order[i - 1] ?? -1))).toBe(
      true,
    )
  })

  it("opens a sibling outliner input right after the selected row's entire subtree, not right after the row itself", async () => {
    const child = makeNode({
      id: 'child-1',
      title: 'Child Task',
      parentId: 'root-1',
    })
    const root = makeNode({
      id: 'root-1',
      number: 1,
      title: 'Root With A Child',
      children: [child],
      childCompletionCount: { completed: 0, total: 1 },
    })
    const nextRoot = makeNode({
      id: 'root-2',
      number: 2,
      title: 'Next Root',
    })
    await renderTaskTreeList([root, nextRoot])

    fireEvent.click(screen.getByText('Root With A Child'))
    fireEvent.keyDown(document.body, { key: 'o' })

    // Document position, not textContent order: the input's own text is a
    // placeholder attribute, invisible to `.textContent`.
    const isBefore = (a: Node, b: Node) =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

    const childRow = screen.getByText('Child Task')
    const input = screen.getByPlaceholderText(/New task/i)
    const nextRootRow = screen.getByText('Next Root')

    expect(isBefore(childRow, input)).toBe(true)
    expect(isBefore(input, nextRootRow)).toBe(true)
  })
})
