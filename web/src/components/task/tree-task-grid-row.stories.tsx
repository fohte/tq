import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { expect, waitFor, within } from 'storybook/test'

import type { TreeTaskGridRowProps } from '#components/task/tree-task-grid-row'
import { TreeTaskGridRow } from '#components/task/tree-task-grid-row'
import type { TaskAgentSession } from '#hooks/use-task-agent-sessions'
import type { TreeNode } from '#hooks/use-tasks'
import { useTreeOutliner } from '#hooks/use-tree-outliner'
import { emptyLabelsHandler, emptyTasksHandler } from '#lib/msw-test-handlers'
import { assertDefined, atIndex, findVisible } from '#lib/test-utils'
import { createStoryRouter, StoryRouter } from '#storybook-config/story-router'

const TASK_LIST_ROUTES = ['/tasks', '/tasks/$taskId']

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
  parentNumber: null,
  projectId: null,
  recurrenceRuleId: null,
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

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter component={() => <>{children}</>} paths={TASK_LIST_ROUTES} />
    </QueryClientProvider>
  )
}

// Expand/collapse, selection, and the outliner input are all owned by
// useTreeOutliner rather than local state, so interactive stories drive the
// row through the real hook instead of a hand-rolled prop harness.
function InteractiveTreeTaskGridRow({
  node,
  sessionsByTaskId = new Map(),
}: {
  node: TreeNode
  sessionsByTaskId?: ReadonlyMap<string, TaskAgentSession[]>
}) {
  const outliner = useTreeOutliner([node], { enabled: true })

  return (
    <TreeTaskGridRow
      node={node}
      sessionsByTaskId={sessionsByTaskId}
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
          sessionsByTaskId={new Map()}
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
          HttpResponse.json({
            id: 'project-1',
            title: 'tq',
            description: null,
            status: 'active',
            startDate: null,
            targetDate: null,
            color: null,
            sortOrder: 0,
            createdAt: '2026-03-20T00:00:00.000Z',
            updatedAt: '2026-03-20T00:00:00.000Z',
            completionRate: 0.4,
            taskCount: { total: 10, completed: 4 },
          }),
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

export const TagClick: Story = (() => {
  const node: TreeNode = {
    ...baseTreeNode,
    title: 'Click a tag token',
    labels: ['dev:tq'],
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  let router: ReturnType<typeof createStoryRouter>

  return {
    args: { node },
    render: (args) => {
      router = createStoryRouter({
        component: () => (
          <div className="w-full max-w-3xl">
            <InteractiveTreeTaskGridRow node={args.node} />
          </div>
        ),
        paths: TASK_LIST_ROUTES,
      })
      return (
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      )
    },
    play: async ({ canvas, userEvent }) => {
      await userEvent.click(canvas.getByText('#dev:tq'))
      await expect(router.history.location.pathname).toBe('/tasks')
    },
  }
})()

export const ClickNavigates: Story = (() => {
  const node: TreeNode = {
    ...baseTreeNode,
    title: 'Click this row to navigate',
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  let router: ReturnType<typeof createStoryRouter>

  return {
    args: { node },
    render: (args) => {
      router = createStoryRouter({
        component: () => (
          <div className="w-full max-w-3xl">
            <InteractiveTreeTaskGridRow node={args.node} />
          </div>
        ),
        paths: TASK_LIST_ROUTES,
      })
      return (
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      )
    },
    play: async ({ args, canvas, userEvent }) => {
      await userEvent.click(canvas.getByText(args.node.title))
      await expect(router.history.location.pathname).toBe(
        `/tasks/${args.node.id}`,
      )
    },
  }
})()

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

// Kept relative to `Date.now()` (not a fixed ISO literal) so this session
// keeps rendering as active (isAgentSessionActive) no matter when this story
// runs.
const activeSession: TaskAgentSession = {
  id: '00000000-0000-0000-0000-0000000000a1',
  taskId: baseTreeNode.id,
  provider: 'claude_code',
  sessionId: 'session-active',
  context: 'work',
  cwd: '/Users/fohte/ghq/github.com/fohte/tq',
  label: 'Implement tree session rows',
  lastMessage: 'Wiring up the sessions endpoint',
  customLabel: null,
  startedAt: new Date(Date.now() - 34 * 60_000).toISOString(),
  lastActiveAt: new Date(Date.now() - 2 * 60_000).toISOString(),
  endedAt: null,
}

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
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.hover(
      atIndex(canvas.getAllByTestId('session-indicator'), 0),
    )

    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() =>
      expect(body.getByText('Implement tree session rows')).toBeVisible(),
    )
    await expect(body.getByText('Write the release notes')).toBeVisible()
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
  // The narrow container below (w-xl, 576px) is wider than the mobile
  // viewport (375px) on purpose — see the comment on it — so it always
  // overflows the mobile project regardless of content. desktop-only skips
  // that project instead of fixing the width or disabling the check.
  tags: ['desktop-only'],
  parameters: {
    // The title `<span>` has a `min-w-30` (120px) floor, not `min-w-0` —
    // without it, the title would shrink to 0 width instead of the row
    // overflowing once the container is narrower than the row's content
    // needs (see tree-task-grid-row.tsx). The container below is
    // deliberately that narrow, so every row overflowing here is the
    // regression check itself (see the play function verifying the title
    // never collapses), not a bug to fix. Scoped to `narrow-row-container`
    // below rather than disabling the whole story, so overflow added
    // elsewhere in this story would still be caught. `* below the
    // container is needed alongside the container itself because
    // ignoreSelectors only exempts the elements it matches, not their
    // descendants.
    overflowCheck: {
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
        id: '2',
        title: 'In progress task',
        status: 'in_progress',
      },
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
  play: async ({ canvas }) => {
    // Regression check: this container is narrower than the row's content
    // needs, so without the title span's `min-w-30` floor (see
    // tree-task-grid-row.tsx) the title collapses to 0 width instead of
    // truncating.
    const title = canvas.getByText('Todo task (personal)')
    await expect(title.getBoundingClientRect().width).toBeGreaterThan(0)
  },
}

export const Hovered: Story = {
  args: {
    node: { ...baseTreeNode, title: 'Hover to reveal the ⋯ actions menu' },
  },
  play: async ({ canvasElement }) => {
    // ActionsMenu itself renders a responsive pair — a dropdown trigger and
    // an action-sheet trigger — and toggles which is visible via `hidden
    // md:flex` / `flex md:hidden` (see actions-menu.tsx), so only one of the
    // two candidates below is ever reachable at a given viewport. The
    // hidden one's *wrapper* is `display: none`, which a plain
    // `getComputedStyle` on the trigger itself can't see (the trigger's own
    // class alone may still compute to a visible `display`) —
    // checkVisibility() walks ancestors instead. It ignores `opacity` by
    // default, so the desktop trigger's opacity-0 hover-reveal (checked
    // below) still counts as reachable here.
    const dropdownTrigger = findVisible(
      Array.from(
        canvasElement.querySelectorAll<HTMLElement>(
          '[data-slot="dropdown-menu-trigger"][aria-label="Task actions"]',
        ),
      ),
    )
    const actionSheetTrigger = findVisible(
      Array.from(
        canvasElement.querySelectorAll<HTMLElement>(
          '[data-slot="action-sheet-trigger"]',
        ),
      ),
    )

    // The mobile ⋯ is always visible; the desktop one only reveals on
    // hover/focus, so the reveal-on-hover behavior only applies there.
    if (actionSheetTrigger) {
      await expect(actionSheetTrigger).toBeVisible()
      return
    }

    const desktopTrigger = assertDefined(
      dropdownTrigger,
      'row-actions trigger not found',
    )

    // storybook/test's userEvent only dispatches synthetic (untrusted)
    // pointer events, which real browsers never honor for the native
    // `:hover` pseudo-class, so it can't force-clear a prior story's real
    // ambient hover left over on this shared browser tab. Only assert the
    // hidden-by-default precondition when `.group` genuinely isn't in the
    // live `:hover` chain right now — on a run where it is, this story
    // provides no regression coverage for the default-hidden behavior, but
    // the focus-reveal assertion below still exercises the same
    // opacity-driven reveal mechanism deterministically.
    const groupEl = desktopTrigger.closest('.group')
    const groupIsHovered = groupEl?.matches(':hover') ?? false
    if (!groupIsHovered) {
      await expect(desktopTrigger).not.toBeVisible()
    }

    // Unlike group-hover, this is the trigger's own `:focus-visible` state
    // (see desktopTriggerClassName in tree-row-actions-menu.tsx), so a real
    // focus() call drives it deterministically.
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
  parameters: {
    // The open row renders CreateTaskInline (via TreeOutlinerInputRow),
    // which fetches labels on mount and, since a parentId is set here, the
    // full task list too.
    msw: {
      handlers: [emptyLabelsHandler, emptyTasksHandler],
    },
  },
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
