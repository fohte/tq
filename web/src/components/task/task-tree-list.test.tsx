import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ROW_INDENT_CLASS_NAME } from '#components/task/task-row-shared'
import { makeNode, makeTask } from '#components/task/task-row-test-fixtures'
import type { TaskTreeListProps } from '#components/task/task-tree-list'
import { TaskTreeList } from '#components/task/task-tree-list'
import type { TreeNode } from '#hooks/use-tasks'
import { atIndex } from '#lib/test-utils'

// fetchTaskList is only exercised by the lazy-mode tests below (regular
// tests never pass lazyChildrenFilter, so TaskTreeList never calls it).
// vi.hoisted (rather than a plain top-level const) is required here: this
// file's own imports transitively reach '#hooks/use-tasks' (e.g. via
// task-row-shared) before a plain const's initializer would have run.
const { mockFetchTaskList } = vi.hoisted(() => ({ mockFetchTaskList: vi.fn() }))

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
    fetchTaskList: mockFetchTaskList,
  }
})

vi.mock('#hooks/use-projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-projects')>()
  return {
    ...actual,
    useProject: () => ({ data: undefined }),
  }
})

// Every router already registers a document-level scroll listener on
// construction and never removes it, but onScroll no-ops unless
// router.isScrollRestoring is true. useElementScrollRestoration is what
// flips that flag (via a forced setupScrollRestoration(router, true)); with
// it stubbed out, isScrollRestoring stays false for every fresh router this
// file builds, so a stray throttled callback firing after jsdom teardown
// exits before touching `document` instead of throwing
// "document is not defined". None of these tests assert on restored scroll
// position.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useElementScrollRestoration: () => undefined,
  }
})

// The router's first route match resolves asynchronously even with no
// loaders, so router.load() is awaited before render() to avoid an initial
// blank paint (see https://tanstack.com/router/latest/docs/framework/react/guide/testing).
async function renderTaskTreeList(
  tree: TreeNode[],
  extraProps: Partial<TaskTreeListProps> = {},
  wrap: (children: ReactNode) => ReactNode = (children) => children,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
    component: () =>
      wrap(
        <TaskTreeList
          isLoading={false}
          tree={tree}
          tasks={[]}
          sessionsByTaskId={new Map()}
          {...extraProps}
        />,
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
  mockFetchTaskList.mockResolvedValue([])
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
      expect(el.classList.contains(ROW_INDENT_CLASS_NAME)).toBe(true)
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

  it("opens the create-task modal with the selected row's parent when 'o' is pressed on a child row", async () => {
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
    await renderTaskTreeList([root])

    fireEvent.click(screen.getByText('Child Task'))
    fireEvent.keyDown(document.body, { key: 'o' })

    await screen.findAllByPlaceholderText(/task title|タスクのタイトル/i)
    expect(screen.getAllByText(/#1 Root With A Child/).length).toBeGreaterThan(
      0,
    )
  })

  it("opens the create-task modal with no parent indicator when 'o' is pressed on a root row", async () => {
    const root = makeNode({ id: 'root-1', number: 1, title: 'Root Task' })
    await renderTaskTreeList([root])

    fireEvent.click(screen.getByText('Root Task'))
    fireEvent.keyDown(document.body, { key: 'o' })

    await screen.findAllByPlaceholderText(/task title|タスクのタイトル/i)
    expect(screen.queryByText(/#1 Root Task/)).toBeNull()
  })

  it('keeps rows far past the visible range out of the DOM', async () => {
    const roots = Array.from({ length: 200 }, (_, i) =>
      makeNode({
        id: `root-${String(i)}`,
        number: i + 1,
        title: `Root Task ${String(i)}`,
      }),
    )
    await renderTaskTreeList(roots)

    expect(screen.getByText('Root Task 0')).toBeInTheDocument()
    expect(screen.queryByText('Root Task 199')).not.toBeInTheDocument()
  })

  it('virtualizes against an ancestor scroll container when ancestorScrollRestorationId is set', async () => {
    const roots = Array.from({ length: 200 }, (_, i) =>
      makeNode({
        id: `root-${String(i)}`,
        number: i + 1,
        title: `Root Task ${String(i)}`,
      }),
    )
    await renderTaskTreeList(
      roots,
      { ancestorScrollRestorationId: 'outer' },
      (children) => <div data-scroll-restoration-id="outer">{children}</div>,
    )

    expect(screen.getByText('Root Task 0')).toBeInTheDocument()
    expect(screen.queryByText('Root Task 199')).not.toBeInTheDocument()
  })
})

describe('TaskTreeList lazyChildrenFilter', () => {
  it("starts collapsed and fetches a row's children only once it is expanded", async () => {
    const user = userEvent.setup()
    const root = makeNode({
      id: 'root-1',
      title: 'Root Task',
      childCompletionCount: { completed: 0, total: 1 },
    })
    const child = makeTask({
      id: 'child-1',
      title: 'Lazily Fetched Child',
      parentId: 'root-1',
    })
    mockFetchTaskList.mockImplementation((filter?: { parentId?: string }) =>
      Promise.resolve(filter?.parentId === 'root-1' ? [child] : []),
    )

    await renderTaskTreeList([root], {
      lazyChildrenFilter: { q: 'is:todo' },
    })

    expect(screen.getByLabelText('Expand')).toBeInTheDocument()
    expect(mockFetchTaskList).not.toHaveBeenCalled()
    expect(screen.queryByText('Lazily Fetched Child')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Expand'))

    expect(await screen.findByText('Lazily Fetched Child')).toBeInTheDocument()
    expect(mockFetchTaskList).toHaveBeenCalledWith({
      q: 'is:todo',
      parentId: 'root-1',
    })
  })
})

// jsdom has no IntersectionObserver; this stub captures the callback passed
// by TaskTreeList's sentinel effect so a test can invoke it directly instead
// of simulating a real scroll/resize.
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []
  callback: (entries: { isIntersecting: boolean }[]) => void
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()

  constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
    this.callback = callback
    MockIntersectionObserver.instances.push(this)
  }

  trigger(isIntersecting: boolean) {
    this.callback([{ isIntersecting }])
  }
}

describe('TaskTreeList infinite scroll pagination', () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = []
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls fetchNextPage when the load-more sentinel intersects the viewport', async () => {
    const fetchNextPage = vi.fn()
    const root = makeNode({ id: 'root-1', title: 'Root Task' })
    await renderTaskTreeList([root], {
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage,
    })

    const observer = MockIntersectionObserver.instances[0]
    if (observer == null) throw new Error('expected an IntersectionObserver')
    observer.trigger(true)

    expect(fetchNextPage).toHaveBeenCalledTimes(1)
  })

  it('does not call fetchNextPage while a page is already being fetched', async () => {
    const fetchNextPage = vi.fn()
    const root = makeNode({ id: 'root-1', title: 'Root Task' })
    await renderTaskTreeList([root], {
      hasNextPage: true,
      isFetchingNextPage: true,
      fetchNextPage,
    })

    const observer = MockIntersectionObserver.instances[0]
    if (observer == null) throw new Error('expected an IntersectionObserver')
    observer.trigger(true)

    expect(fetchNextPage).not.toHaveBeenCalled()
  })

  it('shows a loading-more message while fetching the next page', async () => {
    const root = makeNode({ id: 'root-1', title: 'Root Task' })
    await renderTaskTreeList([root], { isFetchingNextPage: true })

    expect(screen.getByText('Loading more...')).toBeInTheDocument()
  })
})
