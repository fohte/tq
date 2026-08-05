import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { expect } from 'storybook/test'

import { TagFilterBar } from '#components/tag-filter-bar'
import type { TreeTaskGridRowProps } from '#components/task/tree-task-grid-row'
import { TreeTaskGridRow } from '#components/task/tree-task-grid-row'
import type { TreeNode } from '#hooks/use-tasks'
import { useTreeOutliner } from '#hooks/use-tree-outliner'
import { atIndex } from '#lib/test-utils'

const baseTreeNode: TreeNode = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 1,
  title: 'Implement task list UI',
  description: null,
  status: 'todo',
  context: 'personal',
  labels: [],
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  projectId: null,
  sortOrder: 0,
  recurrenceRuleId: null,
  recurrenceRule: null,
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  children: [],
  childCompletionCount: { completed: 0, total: 0 },
}

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const rootRoute = createRootRoute({
    component: () => <>{children}</>,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const taskRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId',
    component: () => null,
  })
  rootRoute.addChildren([indexRoute, taskRoute])

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

// Expand/collapse, selection, and the outliner input are all owned by
// useTreeOutliner rather than local state, so interactive stories drive the
// row through the real hook instead of a hand-rolled prop harness.
function InteractiveTreeTaskGridRow({ node }: { node: TreeNode }) {
  const outliner = useTreeOutliner([node], { enabled: true })

  return (
    <TreeTaskGridRow
      node={node}
      isExpanded={outliner.isExpanded}
      onToggleExpand={outliner.toggleExpand}
      selectedRowId={outliner.selectedRowId}
      onSelectRow={outliner.selectRow}
      outlinerInput={outliner.outlinerInput}
      outlinerTarget={outliner.outlinerTarget}
      onOpenChildInput={outliner.openChildInput}
      onCloseOutlinerInput={outliner.closeOutlinerInput}
      onIndentOutlinerInput={outliner.indentOutlinerInput}
      onOutdentOutlinerInput={outliner.outdentOutlinerInput}
    />
  )
}

function TreeTaskGridRowWithProviders({ node }: { node: TreeNode }) {
  return (
    <Providers>
      <div className="w-[600px]">
        <InteractiveTreeTaskGridRow node={node} />
      </div>
    </Providers>
  )
}

// For stories that showcase a specific, non-default outliner/selection
// state without needing to drive it there via interaction.
function StaticTreeTaskGridRow(
  props: Partial<TreeTaskGridRowProps> & { node: TreeNode },
) {
  return (
    <Providers>
      <div className="w-[600px]">
        <TreeTaskGridRow
          isExpanded={() => true}
          onToggleExpand={() => {}}
          selectedRowId={null}
          onSelectRow={() => {}}
          outlinerInput={null}
          outlinerTarget={null}
          onOpenChildInput={() => {}}
          onCloseOutlinerInput={() => {}}
          onIndentOutlinerInput={() => {}}
          onOutdentOutlinerInput={() => {}}
          {...props}
        />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TreeTaskGridRow',
  component: TreeTaskGridRowWithProviders,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TreeTaskGridRowWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const Todo: Story = {
  args: {
    node: { ...baseTreeNode },
  },
}

export const InProgress: Story = {
  args: {
    node: {
      ...baseTreeNode,
      status: 'in_progress',
      title: 'Review pull request',
    },
  },
}

export const Completed: Story = {
  args: {
    node: {
      ...baseTreeNode,
      status: 'completed',
      title: 'Set up CI pipeline',
    },
  },
}

export const WithEstimate: Story = {
  args: {
    node: {
      ...baseTreeNode,
      title: 'Write API documentation',
      estimatedMinutes: 120,
    },
  },
}

export const WorkContext: Story = {
  args: {
    node: {
      ...baseTreeNode,
      title: 'Deploy to production',
      context: 'work',
      estimatedMinutes: 30,
    },
  },
}

export const WithDueDate: Story = {
  args: {
    node: {
      ...baseTreeNode,
      title: 'Submit expense report',
      // Far future so this story never flips to overdue.
      dueDate: '2099-06-15',
    },
  },
}

export const Overdue: Story = {
  args: {
    node: {
      ...baseTreeNode,
      title: 'Renew SSL certificate',
      // Fixed past date so this story always renders as overdue.
      dueDate: '2020-01-01',
    },
  },
}

export const OverdueCompleted: Story = {
  args: {
    node: {
      ...baseTreeNode,
      status: 'completed',
      title: 'Renew SSL certificate',
      dueDate: '2020-01-01',
    },
  },
}

export const WithGithubLink: Story = {
  args: {
    node: {
      ...baseTreeNode,
      title: 'Fix flaky test',
      githubLink: {
        id: 'link-1',
        owner: 'fohte',
        repo: 'tq',
        number: 42,
        kind: 'pull_request',
        url: 'https://github.com/fohte/tq/pull/42',
        state: 'merged',
        title: 'Fix flaky test',
        lastSyncedAt: '2026-03-20T00:00:00.000Z',
      },
    },
  },
}

export const WithTags: Story = {
  args: {
    node: {
      ...baseTreeNode,
      title: 'Ship the release notes',
      labels: ['dev:tq', 'chore'],
    },
  },
}

export const TagClick: Story = {
  args: {
    node: {
      ...baseTreeNode,
      title: 'Click a tag token',
      labels: ['dev:tq'],
    },
  },
  render: (args) => (
    <Providers>
      <div className="w-[600px]">
        <InteractiveTreeTaskGridRow node={args.node} />
        <TagFilterBar />
      </div>
    </Providers>
  ),
  play: async ({ canvas, userEvent }) => {
    // Both the desktop and mobile layouts render at once (only CSS toggles
    // which is visible), so the tag token exists twice — click either one.
    await userEvent.click(atIndex(canvas.getAllByText('#dev:tq'), 0))
    await expect(canvas.getByText('filtered by')).toBeVisible()
  },
}

export const WithChildren: Story = {
  args: {
    node: {
      ...baseTreeNode,
      title: 'Parent task',
      children: [
        {
          ...baseTreeNode,
          id: '00000000-0000-0000-0000-000000000002',
          title: 'Child task 1',
          parentId: baseTreeNode.id,
        },
        {
          ...baseTreeNode,
          id: '00000000-0000-0000-0000-000000000003',
          title: 'Child task 2',
          status: 'completed',
          parentId: baseTreeNode.id,
        },
      ],
      childCompletionCount: { completed: 1, total: 2 },
    },
  },
}

export const Nested: Story = {
  args: {
    node: {
      ...baseTreeNode,
      title: 'Root task',
      children: [
        {
          ...baseTreeNode,
          id: '00000000-0000-0000-0000-000000000002',
          title: 'Child task',
          parentId: baseTreeNode.id,
          children: [
            {
              ...baseTreeNode,
              id: '00000000-0000-0000-0000-000000000004',
              title: 'Grandchild task',
              parentId: '00000000-0000-0000-0000-000000000002',
            },
          ],
          childCompletionCount: { completed: 0, total: 1 },
        },
      ],
      childCompletionCount: { completed: 0, total: 1 },
    },
  },
}

export const WithCompletionCount: Story = {
  args: {
    node: {
      ...baseTreeNode,
      title: 'Sprint planning',
      context: 'work',
      children: [
        {
          ...baseTreeNode,
          id: '00000000-0000-0000-0000-000000000002',
          title: 'Review PRs',
          status: 'completed',
          parentId: baseTreeNode.id,
        },
        {
          ...baseTreeNode,
          id: '00000000-0000-0000-0000-000000000003',
          title: 'Write tests',
          status: 'completed',
          parentId: baseTreeNode.id,
          estimatedMinutes: 60,
        },
        {
          ...baseTreeNode,
          id: '00000000-0000-0000-0000-000000000005',
          title: 'Deploy to staging',
          parentId: baseTreeNode.id,
          estimatedMinutes: 30,
        },
      ],
      childCompletionCount: { completed: 2, total: 3 },
    },
  },
}

export const AllVariants: Story = {
  args: { node: baseTreeNode },
  render: () => {
    const nodes: TreeNode[] = [
      { ...baseTreeNode, id: '1', title: 'Todo task (personal)' },
      {
        ...baseTreeNode,
        id: '2',
        title: 'In progress task',
        status: 'in_progress',
        estimatedMinutes: 60,
      },
      {
        ...baseTreeNode,
        id: '3',
        title: 'Completed task',
        status: 'completed',
        estimatedMinutes: 30,
      },
      {
        ...baseTreeNode,
        id: '4',
        title: 'Work context with estimate',
        context: 'work',
        estimatedMinutes: 120,
      },
      {
        ...baseTreeNode,
        id: '5',
        title: 'Task with children',
        children: [
          {
            ...baseTreeNode,
            id: '5-1',
            title: 'Child task',
            parentId: '5',
          },
        ],
        childCompletionCount: { completed: 0, total: 1 },
      },
    ]

    return (
      <Providers>
        <div className="w-[600px] divide-y divide-border">
          {nodes.map((node) => (
            <InteractiveTreeTaskGridRow key={node.id} node={node} />
          ))}
        </div>
      </Providers>
    )
  },
}

export const Hovered: Story = {
  args: {
    node: { ...baseTreeNode, title: 'Hover to reveal the ⋯ actions menu' },
  },
  play: async ({ canvasElement }) => {
    // `[data-slot="dropdown-menu-trigger"]` alone also matches the row's
    // status picker, which sits earlier in the DOM — scope to the
    // row-actions menu by its accessible name.
    const desktopTrigger = canvasElement.querySelector<HTMLElement>(
      '[data-slot="dropdown-menu-trigger"][aria-label="Task actions"]',
    )
    const mobileTrigger = canvasElement.querySelector<HTMLElement>(
      '[data-slot="action-sheet-trigger"]',
    )
    if (desktopTrigger == null || mobileTrigger == null) {
      throw new Error('row-actions triggers not found')
    }

    // The mobile ⋯ is always visible; the desktop one only reveals on
    // hover/focus, so the reveal-on-hover behavior only applies there.
    if (getComputedStyle(mobileTrigger).display !== 'none') {
      await expect(mobileTrigger).toBeVisible()
      return
    }

    // `userEvent.hover()` dispatches synthetic pointer events, which real
    // browsers don't honor for `:hover`/`group-hover` matching — the trigger
    // reveals on focus too, so drive it with a real focus change instead.
    await expect(desktopTrigger).not.toBeVisible()
    desktopTrigger.focus()
    await expect(desktopTrigger).toBeVisible()
  },
}

export const Selected: Story = {
  args: { node: baseTreeNode },
  render: () => (
    <StaticTreeTaskGridRow
      node={{ ...baseTreeNode, title: 'Selected row' }}
      selectedRowId={baseTreeNode.id}
    />
  ),
}

export const AddSubtaskInputOpen: Story = {
  args: { node: baseTreeNode },
  render: () => {
    const node: TreeNode = {
      ...baseTreeNode,
      title: 'Parent with an open add-subtask row',
    }

    return (
      <StaticTreeTaskGridRow
        node={node}
        outlinerInput={{ anchorRowId: node.id, mode: 'child' }}
        outlinerTarget={{
          anchorRowId: node.id,
          mode: 'child',
          parentId: node.id,
          parentNumber: node.number,
          depth: 1,
          inherited: undefined,
        }}
      />
    )
  },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByPlaceholderText(/New task/i),
    ).toBeInTheDocument()
  },
}
