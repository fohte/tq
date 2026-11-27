import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ROW_INDENT_CLASS_NAME } from '#components/task/task-row-shared'
import { makeNode, makeTask } from '#components/task/task-row-test-fixtures'
import type { TaskTreeListProps } from '#components/task/task-tree-list'
import { TaskTreeList } from '#components/task/task-tree-list'
import { allTasksFilter, type TreeNode } from '#hooks/use-tasks'
import { MockIntersectionObserver } from '#lib/mock-intersection-observer/test-utils'
import { assertDefined, atIndex } from '#lib/test-utils'

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

// The router's first route match resolves asynchronously even with no
// loaders, so router.load() is awaited before render() to avoid an initial
// blank paint (see https://tanstack.com/router/latest/docs/framework/react/guide/testing).
async function renderTaskTreeLists(
  lists: Array<{
    tree: TreeNode[]
    props: Partial<TaskTreeListProps>
    testId?: string
  }>,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => (
      <>
        {lists.map(({ tree, props, testId }, index) => {
          const taskTreeList = (
            <TaskTreeList
              key={index}
              isLoading={false}
              tree={tree}
              tasks={[]}
              sessionsByTaskId={new Map()}
              {...props}
            />
          )
          return testId == null ? (
            taskTreeList
          ) : (
            <div key={index} data-testid={testId}>
              {taskTreeList}
            </div>
          )
        })}
      </>
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

async function renderTaskTreeList(
  tree: TreeNode[],
  extraProps: Partial<TaskTreeListProps> = {},
) {
  return renderTaskTreeLists([{ tree, props: extraProps }])
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

  it('does not open a create-task modal when grouped lists disable row shortcuts', async () => {
    const firstRoot = makeNode({
      id: 'first-root',
      number: 1,
      title: 'First Group Task',
    })
    const secondRoot = makeNode({
      id: 'second-root',
      number: 2,
      title: 'Second Group Task',
    })
    await renderTaskTreeLists([
      {
        tree: [firstRoot],
        props: { enableKeyboardShortcuts: false },
      },
      {
        tree: [secondRoot],
        props: { enableKeyboardShortcuts: false },
      },
    ])

    fireEvent.click(screen.getByText('First Group Task'))
    fireEvent.click(screen.getByText('Second Group Task'))
    fireEvent.keyDown(document.body, { key: 'o' })

    expect(screen.queryAllByRole('dialog').length).toEqual(0)
  })

  it("opens the create-task modal with the row's parent when 'add subtask' is clicked via the row actions menu", async () => {
    const user = userEvent.setup()
    const root = makeNode({ id: 'root-1', number: 5, title: 'Parent Task' })
    const { container } = await renderTaskTreeList([root])

    const trigger = assertDefined(
      container.querySelector<HTMLElement>(
        '[data-slot="dropdown-menu-trigger"][aria-label="Task actions"]',
      ),
      'desktop trigger not found',
    )
    await user.click(trigger)
    await user.click(
      await screen.findByRole('menuitem', { name: /add subtask/i }),
    )

    await screen.findAllByPlaceholderText(/task title|タスクのタイトル/i)
    expect(screen.getAllByText(/#5 Parent Task/).length).toBeGreaterThan(0)
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

  // The container's offsetTop (faked to 100 in test-setup.ts) is subtracted
  // back out of each row's translateY, keeping row position list-relative.
  it('cancels the scroll margin back out of each row position', async () => {
    const root = makeNode({ id: 'root-1', title: 'Root Task' })
    await renderTaskTreeList([root])

    const row = screen.getByText('Root Task').closest('[data-index]')
    if (!(row instanceof HTMLElement)) {
      throw new Error('Expected the row to have a data-index ancestor')
    }
    expect(row.style.transform).toBe('translateY(0px)')
  })

  // Guards against reverting to a mount-only effect: without an observer
  // re-watching the document, content resizing above the list after mount
  // (e.g. a wrapping filter chip row) would never update scrollMargin again.
  it('re-measures scrollMargin via a ResizeObserver on document.body', async () => {
    const observe = vi.fn()
    class MockResizeObserver {
      observe = observe
      disconnect = vi.fn()
      unobserve = vi.fn()
    }
    vi.stubGlobal('ResizeObserver', MockResizeObserver)

    const root = makeNode({ id: 'root-1', title: 'Root Task' })
    await renderTaskTreeList([root])

    expect(observe).toHaveBeenCalledWith(document.body)

    vi.unstubAllGlobals()
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
      lazyChildrenFilter: {
        q: 'is:todo',
        ...allTasksFilter,
      },
    })

    expect(screen.getByLabelText('Expand')).toBeInTheDocument()
    expect(mockFetchTaskList).not.toHaveBeenCalled()
    expect(screen.queryByText('Lazily Fetched Child')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Expand'))

    expect(await screen.findByText('Lazily Fetched Child')).toBeInTheDocument()
    expect(mockFetchTaskList).toHaveBeenCalledWith({
      q: 'is:todo',
      ...allTasksFilter,
      parentId: 'root-1',
    })
  })

  it('restores expansions from multiple lazy lists after remounting', async () => {
    const user = userEvent.setup()
    const alphaRoot = makeNode({
      id: 'root-alpha',
      title: 'Alpha parent',
      childCompletionCount: { completed: 0, total: 1 },
    })
    const betaRoot = makeNode({
      id: 'root-beta',
      title: 'Beta parent',
      childCompletionCount: { completed: 0, total: 1 },
    })
    const alphaChild = makeTask({
      id: 'child-alpha',
      title: 'Alpha child',
      parentId: alphaRoot.id,
    })
    const betaChild = makeTask({
      id: 'child-beta',
      title: 'Beta child',
      parentId: betaRoot.id,
    })
    const childFetchCalls: Array<{ q: string; parentId: string }> = []
    mockFetchTaskList.mockImplementation(
      (filter?: { q: string; parentId?: string }) => {
        if (filter?.parentId == null) return Promise.resolve([])
        if (filter.parentId === alphaRoot.id) {
          childFetchCalls.push({ q: filter.q, parentId: filter.parentId })
          return Promise.resolve([alphaChild])
        }
        if (filter.parentId === betaRoot.id) {
          childFetchCalls.push({ q: filter.q, parentId: filter.parentId })
          return Promise.resolve([betaChild])
        }
        return Promise.resolve([])
      },
    )
    const lists = [
      {
        tree: [alphaRoot],
        props: {
          expandedIdsStorageKey: 'tq:test-project:field-category:option-alpha',
          lazyChildrenFilter: {
            q: 'field:SampleCategory=Alpha',
            ...allTasksFilter,
          },
        },
      },
      {
        tree: [betaRoot],
        props: {
          expandedIdsStorageKey: 'tq:test-project:field-category:option-beta',
          lazyChildrenFilter: {
            q: 'field:SampleCategory=Beta',
            ...allTasksFilter,
          },
        },
      },
    ]

    const firstRender = await renderTaskTreeLists(lists)

    await user.click(assertDefined(screen.getAllByLabelText('Expand')[0]))
    await screen.findByText(alphaChild.title)
    await user.click(screen.getByLabelText('Expand'))
    await screen.findByText(betaChild.title)

    firstRender.unmount()
    childFetchCalls.splice(0)
    mockFetchTaskList.mockClear()
    await renderTaskTreeLists(lists)

    const getRestoredChildCounts = () => ({
      alphaChild: screen.queryAllByText(alphaChild.title).length,
      betaChild: screen.queryAllByText(betaChild.title).length,
    })
    await waitFor(() => {
      expect(getRestoredChildCounts()).toEqual({ alphaChild: 1, betaChild: 1 })
    })
    expect(
      childFetchCalls.sort((left, right) =>
        left.parentId.localeCompare(right.parentId),
      ),
    ).toEqual([
      { q: 'field:SampleCategory=Alpha', parentId: alphaRoot.id },
      { q: 'field:SampleCategory=Beta', parentId: betaRoot.id },
    ])
  })

  it('keeps same-key lazy tree instances in sync across remounts', async () => {
    const user = userEvent.setup()
    const alphaRoot = makeNode({
      id: 'root-alpha',
      title: 'Alpha parent',
      childCompletionCount: { completed: 0, total: 1 },
    })
    const betaRoot = makeNode({
      id: 'root-beta',
      title: 'Beta parent',
      childCompletionCount: { completed: 0, total: 1 },
    })
    const alphaChild = makeTask({
      id: 'child-alpha',
      title: 'Alpha child',
      parentId: alphaRoot.id,
    })
    const betaChild = makeTask({
      id: 'child-beta',
      title: 'Beta child',
      parentId: betaRoot.id,
    })
    mockFetchTaskList.mockImplementation((filter?: { parentId?: string }) =>
      Promise.resolve(
        filter?.parentId === alphaRoot.id
          ? [alphaChild]
          : filter?.parentId === betaRoot.id
            ? [betaChild]
            : [],
      ),
    )
    const rootTree = [alphaRoot, betaRoot]
    const listProps = {
      lazyChildrenFilter: {
        q: 'field:SampleCategory=Alpha',
        ...allTasksFilter,
      },
    }
    const lists = [
      { tree: rootTree, props: listProps, testId: 'desktop-list' },
      { tree: rootTree, props: listProps, testId: 'mobile-list' },
    ]
    const getExpandButton = (container: HTMLElement, title: string) => {
      const row = within(container)
        .getAllByTestId('task-tree-row')
        .find((element) => element.textContent.includes(title))
      if (row == null) throw new Error('Could not find row for ' + title)
      return within(row).getByLabelText('Expand')
    }

    const firstRender = await renderTaskTreeLists(lists)
    const desktopList = screen.getByTestId('desktop-list')
    const mobileList = screen.getByTestId('mobile-list')

    await user.click(getExpandButton(desktopList, alphaRoot.title))
    await screen.findAllByText(alphaChild.title)
    await user.click(getExpandButton(mobileList, betaRoot.title))
    await screen.findAllByText(betaChild.title)

    firstRender.unmount()
    await renderTaskTreeLists(lists)

    const getRestoredChildCounts = () => {
      const desktop = screen.getByTestId('desktop-list')
      const mobile = screen.getByTestId('mobile-list')
      return {
        desktopAlpha: within(desktop).queryAllByText(alphaChild.title).length,
        desktopBeta: within(desktop).queryAllByText(betaChild.title).length,
        mobileAlpha: within(mobile).queryAllByText(alphaChild.title).length,
        mobileBeta: within(mobile).queryAllByText(betaChild.title).length,
      }
    }
    await waitFor(() => {
      expect(getRestoredChildCounts()).toEqual({
        desktopAlpha: 1,
        desktopBeta: 1,
        mobileAlpha: 1,
        mobileBeta: 1,
      })
    })
  })
})

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
