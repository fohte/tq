import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'

import { makeTaskAgentSession } from '#components/agent-session/task-agent-session-test-fixtures'
import { makeProject } from '#components/project/project-test-fixtures'
import { makeGithubLink } from '#components/task/github-link-test-fixtures'
import { makeNode } from '#components/task/task-row-test-fixtures'
import type { TreeTaskGridRowProps } from '#components/task/tree-task-grid-row'
import { TreeTaskGridRow } from '#components/task/tree-task-grid-row'
import type { TaskAgentSession } from '#hooks/use-task-agent-sessions'
import type { TreeNode } from '#hooks/use-tasks'
import { useTreeOutliner } from '#hooks/use-tree-outliner'
import { StoryRouter } from '#storybook-config/story-router'

const TASK_LIST_ROUTES = ['/tasks', '/tasks/$taskId']

const baseTreeNode: TreeNode = makeNode({
  id: '00000000-0000-0000-0000-000000000001',
  title: 'Implement task list UI',
})

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter component={() => <>{children}</>} paths={TASK_LIST_ROUTES} />
    </QueryClientProvider>
  )
}

// Expand/collapse and selection are owned by useTreeOutliner rather than
// local state, so interactive stories drive the row through the real hook
// instead of a hand-rolled prop harness.
function InteractiveTreeTaskGridRow({
  node,
  sessionsByTaskId = new Map(),
}: {
  node: TreeNode
  sessionsByTaskId?: ReadonlyMap<string, TaskAgentSession[]>
}) {
  const outliner = useTreeOutliner([node], {
    enabled: true,
    onOpenSiblingCreate: () => {},
  })

  return (
    <TreeTaskGridRow
      node={node}
      hasChildren={node.children.length > 0}
      sessionsByTaskId={sessionsByTaskId}
      isExpanded={outliner.isExpanded}
      onToggleExpand={outliner.toggleExpand}
      selectedRowId={outliner.selectedRowId}
      onSelectRow={outliner.selectRow}
      onAddSubtask={() => {}}
    />
  )
}

function TreeTaskGridRowWithProviders({ node }: { node: TreeNode }) {
  return (
    <Providers>
      <div className="w-full max-w-3xl">
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
      <div className="w-full max-w-3xl">
        <TreeTaskGridRow
          hasChildren={false}
          sessionsByTaskId={new Map()}
          isExpanded={() => true}
          onToggleExpand={() => {}}
          selectedRowId={null}
          onSelectRow={() => {}}
          onAddSubtask={() => {}}
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

export const Completed: Story = {
  args: {
    node: {
      ...baseTreeNode,
      status: 'completed',
      title: 'Set up CI pipeline',
    },
  },
}

export const WithGithubLink: Story = {
  args: {
    node: {
      ...baseTreeNode,
      title: 'Fix flaky test',
      githubLinks: [
        makeGithubLink({
          kind: 'pull_request',
          url: 'https://github.com/fohte/tq/pull/42',
          state: 'merged',
          title: 'Fix flaky test',
        }),
      ],
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

export const WithStartDate: Story = {
  args: {
    node: {
      ...baseTreeNode,
      title: 'Task with a start date',
      startDate: '2026-03-25',
    },
  },
}

export const WithDueDate: Story = {
  args: {
    node: {
      ...baseTreeNode,
      title: 'Task with a due date',
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

export const WithProject: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/projects/:id', () =>
          HttpResponse.json(
            makeProject({
              id: 'project-1',
              completionRate: 0.4,
              taskCount: { total: 10, completed: 4 },
            }),
          ),
        ),
      ],
    },
  },
  args: {
    node: {
      ...baseTreeNode,
      title: 'Ship the release notes',
      projectId: 'project-1',
    },
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

// Kept relative to `Date.now()` (not a fixed ISO literal) so this session
// keeps rendering as active (isAgentSessionActive) no matter when this story
// runs.
const activeSession: TaskAgentSession = makeTaskAgentSession({
  id: '00000000-0000-0000-0000-0000000000a1',
  taskId: baseTreeNode.id,
  taskTitle: baseTreeNode.title,
  sessionId: 'session-active',
  label: 'Implement tree session rows',
  lastMessage: 'Wiring up the sessions endpoint',
  startedAt: new Date(Date.now() - 34 * 60_000).toISOString(),
  lastActiveAt: new Date(Date.now() - 2 * 60_000).toISOString(),
})

const endedSession: TaskAgentSession = {
  ...activeSession,
  id: '00000000-0000-0000-0000-0000000000a2',
  sessionId: 'session-ended',
  label: 'Write the release notes',
  startedAt: '2026-08-20T09:00:00Z',
  lastActiveAt: '2026-08-20T10:15:00Z',
  endedAt: '2026-08-20T10:15:00Z',
}

export const WithActiveSessions: Story = {
  args: { node: baseTreeNode },
  render: () => (
    <Providers>
      <div className="w-full max-w-3xl">
        <InteractiveTreeTaskGridRow
          node={{ ...baseTreeNode, title: 'Task with agent sessions' }}
          sessionsByTaskId={
            new Map([[baseTreeNode.id, [activeSession, endedSession]]])
          }
        />
      </div>
    </Providers>
  ),
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
        },
        {
          ...baseTreeNode,
          id: '00000000-0000-0000-0000-000000000005',
          title: 'Deploy to staging',
          parentId: baseTreeNode.id,
        },
      ],
      childCompletionCount: { completed: 2, total: 3 },
    },
  },
}

export const AllVariants: Story = {
  args: { node: baseTreeNode },
  // The narrow container below (w-xl, 576px) is intentionally wider than
  // the mobile viewport (375px) — see the comment on it.
  tags: ['desktop-only'],
  parameters: {
    // The narrow container below intentionally overflows the row's
    // min-w-16 title floor — scoped here, not the whole story, so
    // unrelated overflow elsewhere would still be caught.
    overflowCheck: {
      // ignoreSelectors doesn't exempt descendants, hence the `*` too.
      ignoreSelectors: [
        '[data-testid="narrow-row-container"]',
        '[data-testid="narrow-row-container"] *',
      ],
    },
  },
  render: () => {
    const nodes: TreeNode[] = [
      { ...baseTreeNode, id: '1', title: 'Todo task (personal)' },
      {
        ...baseTreeNode,
        id: '3',
        title: 'Completed task',
        status: 'completed',
      },
      {
        ...baseTreeNode,
        id: '4',
        title: 'Work context task',
        context: 'work',
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
        {/* Narrower than the row-story default (max-w-3xl) on purpose — see
            the overflowCheck comment above for why. */}
        <div
          data-testid="narrow-row-container"
          className="w-xl divide-y divide-border"
        >
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
