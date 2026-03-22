import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TreeTaskRow } from '@web/components/task/task-row'
import type { TreeNode } from '@web/hooks/use-tasks'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockHandleStatusAction = vi.fn()
const mockHandleComplete = vi.fn()

vi.mock('@web/hooks/use-tasks', () => ({
  useTaskActions: () => ({
    handleStatusAction: mockHandleStatusAction,
    handleComplete: mockHandleComplete,
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    ...props
  }: { children: React.ReactNode } & Record<string, unknown>) => (
    <a href={String(props['to'] ?? '#')}>{children}</a>
  ),
}))

function makeNode(overrides: Partial<TreeNode> = {}): TreeNode {
  return {
    id: 'parent-1',
    title: 'Parent Task',
    description: null,
    status: 'todo',
    context: 'personal',
    startDate: null,
    dueDate: null,
    estimatedMinutes: null,
    parentId: null,
    projectId: null,
    sortOrder: 0,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    activeTimeBlockStartTime: null,
    children: [],
    childCompletionCount: { completed: 0, total: 0 },
    ...overrides,
  }
}

function renderTree(node: TreeNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <TreeTaskRow node={node} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TreeTaskRow', () => {
  it('renders task title', () => {
    renderTree(makeNode())
    expect(screen.getByText('Parent Task')).toBeInTheDocument()
  })

  it('renders children under parent', () => {
    const node = makeNode({
      children: [
        makeNode({ id: 'child-1', title: 'Child Task', parentId: 'parent-1' }),
      ],
      childCompletionCount: { completed: 0, total: 1 },
    })
    renderTree(node)
    expect(screen.getByText('Parent Task')).toBeInTheDocument()
    expect(screen.getByText('Child Task')).toBeInTheDocument()
  })

  it('shows child completion count', () => {
    const node = makeNode({
      children: [
        makeNode({
          id: 'child-1',
          title: 'Child 1',
          status: 'completed',
          parentId: 'parent-1',
        }),
        makeNode({
          id: 'child-2',
          title: 'Child 2',
          parentId: 'parent-1',
        }),
        makeNode({
          id: 'child-3',
          title: 'Child 3',
          parentId: 'parent-1',
        }),
      ],
      childCompletionCount: { completed: 1, total: 3 },
    })
    renderTree(node)
    const completions = screen.getAllByTestId('child-completion')
    // Parent node should show 1/3
    expect(completions[0]).toHaveTextContent('1/3')
  })

  it('does not show child completion count when no children', () => {
    renderTree(makeNode())
    expect(screen.queryByTestId('child-completion')).not.toBeInTheDocument()
  })

  it('collapses children when toggle is clicked', async () => {
    const user = userEvent.setup()
    const node = makeNode({
      children: [
        makeNode({ id: 'child-1', title: 'Child Task', parentId: 'parent-1' }),
      ],
      childCompletionCount: { completed: 0, total: 1 },
    })
    renderTree(node)

    // Children visible by default
    expect(screen.getByText('Child Task')).toBeInTheDocument()

    // Click collapse button
    const collapseBtn = screen.getAllByLabelText('Collapse')[0]!
    await user.click(collapseBtn)

    // Children hidden
    expect(screen.queryByText('Child Task')).not.toBeInTheDocument()
  })

  it('expands children when toggle is clicked after collapse', async () => {
    const user = userEvent.setup()
    const node = makeNode({
      children: [
        makeNode({ id: 'child-1', title: 'Child Task', parentId: 'parent-1' }),
      ],
      childCompletionCount: { completed: 0, total: 1 },
    })
    renderTree(node)

    // Collapse
    await user.click(screen.getAllByLabelText('Collapse')[0]!)
    expect(screen.queryByText('Child Task')).not.toBeInTheDocument()

    // Expand
    await user.click(screen.getByLabelText('Expand'))
    expect(screen.getByText('Child Task')).toBeInTheDocument()
  })

  it('renders nested children (grandchildren)', () => {
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
    const node = makeNode({
      children: [child],
      childCompletionCount: { completed: 0, total: 1 },
    })
    renderTree(node)

    expect(screen.getByText('Parent Task')).toBeInTheDocument()
    expect(screen.getByText('Child Task')).toBeInTheDocument()
    expect(screen.getByText('Grandchild Task')).toBeInTheDocument()
  })

  it('does not show expand toggle for leaf nodes', () => {
    // A leaf node rendered alone has no expand toggle
    const leaf = makeNode({ id: 'leaf-1', title: 'Leaf Task' })
    renderTree(leaf)
    expect(screen.queryByLabelText('Collapse')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Expand')).not.toBeInTheDocument()
  })
})
