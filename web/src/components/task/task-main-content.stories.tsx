import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { expect, spyOn } from 'storybook/test'

import { AppLayout } from '#components/layout/app-layout'
import { makeProjectDetail } from '#components/project/project-test-fixtures'
import { makeGithubLink } from '#components/task/github-link-test-fixtures'
import {
  TaskMainContent,
  TaskSidebar,
  TaskSidebarMobile,
} from '#components/task/task-detail'
import { makeTaskPage } from '#components/task/task-page-test-fixtures'
import {
  makeTask,
  makeTaskDetail,
} from '#components/task/task-row-test-fixtures'
import type { AgentSession } from '#hooks/use-agent-sessions'
import { labelKeys } from '#hooks/use-labels'
import type { ProjectDetail } from '#hooks/use-projects'
import { projectKeys } from '#hooks/use-projects'
import { activityKeys } from '#hooks/use-task-activity'
import { commentKeys } from '#hooks/use-task-comments'
import type { TaskPage } from '#hooks/use-task-pages'
import type { Task, TaskDetail } from '#hooks/use-tasks'
import { taskKeys } from '#hooks/use-tasks'
import { assertDefined } from '#lib/test-utils'
import { StoryRouter } from '#storybook-config/story-router'

const samplePages: TaskPage[] = [
  makeTaskPage({ taskId: '550e8400-e29b-41d4-a716-446655440000' }),
  makeTaskPage({
    id: 'page-002',
    taskId: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Technical Spec',
    content:
      '# API Design\n\nREST endpoints for the task management system.\n\n## Endpoints\n\n- GET /tasks\n- POST /tasks\n- PATCH /tasks/:id',
    sortOrder: 1,
    createdAt: '2026-03-21T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
  }),
]

const baseTask = makeTaskDetail()

const sampleSubtasks: Task[] = [
  makeTask({
    id: 'aaaa1111-0000-0000-0000-000000000001',
    number: 2,
    title: 'Add inline editing',
    status: 'completed',
    context: 'work',
    estimatedMinutes: 30,
    parentId: baseTask.id,
    parentNumber: baseTask.number,
  }),
  makeTask({
    id: 'aaaa1111-0000-0000-0000-000000000002',
    number: 3,
    title: 'Add sidebar fields',
    context: 'work',
    parentId: baseTask.id,
    parentNumber: baseTask.number,
  }),
]

const sampleSessions: AgentSession[] = [
  {
    id: 'session-001',
    provider: 'claude_code',
    sessionId: 'session-001',
    parentSessionId: null,
    context: 'work',
    cwd: '/Users/fohte/ghq/github.com/tq',
    label: 'Add inline editing',
    lastMessage: 'Implement the inline title editor',
    customLabel: null,
    startedAt: '2026-03-20T09:00:00.000Z',
    lastActiveAt: '2026-03-20T09:34:00.000Z',
    endedAt: '2026-03-20T09:34:00.000Z',
  },
]

function Providers({
  children,
  project,
}: {
  children: ReactNode
  project?: ProjectDetail | undefined
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  // TaskMainContent always mounts TaskActivity; FullPagePC/FullPageSP also
  // mount TaskSidebar (SidebarParentField/SidebarProjectField/
  // SidebarTagsField). Seed every query they read so no individual story
  // needs its own seeding.
  queryClient.setQueryData(commentKeys.all(baseTask.id), [])
  queryClient.setQueryData(activityKeys.all(baseTask.id), [])
  queryClient.setQueryData(taskKeys.list(undefined), [])
  queryClient.setQueryData(labelKeys.list({ context: 'personal' }), [])
  queryClient.setQueryData(
    projectKeys.list(undefined),
    project ? [project] : [],
  )
  if (project) {
    queryClient.setQueryData(projectKeys.detail(project.id), project)
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks', '/tasks/$taskId', '/tasks/$taskId/pages/$pageId']}
      />
    </QueryClientProvider>
  )
}

// --- TaskMainContent Stories ---

function MainContentStory({
  task,
  pages,
  subtasks,
  sessions,
  project,
}: {
  task: TaskDetail
  pages: TaskPage[]
  subtasks: Task[]
  sessions: AgentSession[]
  project?: ProjectDetail | undefined
}) {
  return (
    <Providers project={project}>
      <div className="max-w-2xl p-6">
        <TaskMainContent
          task={task}
          pages={pages}
          subtasks={subtasks}
          sessions={sessions}
        />
      </div>
    </Providers>
  )
}

const mainContentMeta = {
  title: 'Task/TaskDetail/MainContent',
  component: MainContentStory,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    sessions: [],
  },
} satisfies Meta<typeof MainContentStory>

export default mainContentMeta
type Story = StoryObj<typeof mainContentMeta>

export const Default: Story = {
  args: {
    task: { ...baseTask },
    pages: [],
    subtasks: [],
  },
}

export const Completed: Story = {
  args: {
    task: {
      ...baseTask,
      status: 'completed',
      title: 'Set up CI pipeline',
    },
    pages: [],
    subtasks: [],
  },
}

export const NoDescription: Story = {
  args: {
    task: { ...baseTask, description: null, title: 'Task without description' },
    pages: [],
    subtasks: [],
  },
}

export const WithTags: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Task with tags',
      labels: ['dev:tq', 'chore'],
    },
    pages: [],
    subtasks: [],
  },
}

export const WithMultipleGithubLinks: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Add multi-link support',
      githubLinks: [
        makeGithubLink({
          number: 412,
          url: 'https://github.com/fohte/tq/issues/412',
          title: 'Support multiple GitHub links per task',
        }),
        makeGithubLink({
          id: 'link-2',
          number: 436,
          kind: 'pull_request',
          url: 'https://github.com/fohte/tq/pull/436',
          state: 'merged',
          title: 'api: allow associating multiple GitHub links with a task',
        }),
      ],
    },
    pages: [],
    subtasks: [],
  },
}

export const WithParent: Story = {
  args: {
    task: {
      ...baseTask,
      parentId: 'abcd0000-0000-0000-0000-000000000000',
      title: 'Subtask with parent',
    },
    pages: [],
    subtasks: [],
  },
}

export const WithPages: Story = {
  args: {
    task: { ...baseTask, title: 'Task with pages' },
    pages: samplePages,
    subtasks: [],
  },
}

export const WithSubtasks: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Task with subtasks',
      childCompletionCount: { completed: 1, total: 2 },
    },
    pages: [],
    subtasks: sampleSubtasks,
  },
}

export const WithSessions: Story = {
  args: {
    task: { ...baseTask, title: 'Task with sessions' },
    pages: [],
    subtasks: [],
    sessions: sampleSessions,
  },
}

export const LlmAuthored: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Refactor the auth middleware',
      titleAuthor: { kind: 'llm', agent: 'claude-opus-5' },
      descriptionAuthor: { kind: 'llm', agent: 'claude-opus-5' },
    },
    pages: [],
    subtasks: [],
  },
}

const sampleProject: ProjectDetail = makeProjectDetail({
  id: 'aaaa0000-0000-0000-0000-000000000000',
  completionRate: 0.4,
  taskCount: { total: 10, completed: 4 },
})

export const WithProject: Story = {
  args: {
    task: {
      ...baseTask,
      projectId: sampleProject.id,
      title: 'Task with project',
    },
    pages: [],
    subtasks: [],
    project: sampleProject,
  },
}

// --- Full Page Layout ---
// (Sidebar-only stories live in task-detail-sidebar.stories.tsx, co-located
// with TaskSidebar/TaskSidebarMobile; these compose them with
// TaskMainContent to exercise the full page layout.)

export const FullPagePC: StoryObj<{
  task: TaskDetail
  pages: TaskPage[]
  subtasks: Task[]
  sessions: AgentSession[]
}> = {
  args: {
    task: { ...baseTask },
    pages: samplePages,
    subtasks: [],
    sessions: sampleSessions,
  },
  tags: ['desktop-only'],
  parameters: {
    layout: 'fullscreen',
  },
  render: ({ task, pages, subtasks, sessions }) => (
    <Providers>
      <div className="flex h-screen">
        <div className="flex-1 overflow-y-auto px-7 py-6">
          <TaskMainContent
            task={task}
            pages={pages}
            subtasks={subtasks}
            sessions={sessions}
          />
        </div>
        <TaskSidebar task={task} />
      </div>
    </Providers>
  ),
}

export const FullPageSP: StoryObj<{
  task: TaskDetail
  pages: TaskPage[]
  subtasks: Task[]
  sessions: AgentSession[]
}> = {
  args: {
    task: { ...baseTask },
    pages: samplePages,
    subtasks: [],
    sessions: sampleSessions,
  },
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
  },
  render: ({ task, pages, subtasks, sessions }) => (
    <Providers>
      <div className="flex h-screen flex-col overflow-y-auto p-4">
        <TaskSidebarMobile task={task} />
        <div className="mt-4 border-t border-border pt-4">
          <TaskMainContent
            task={task}
            pages={pages}
            subtasks={subtasks}
            sessions={sessions}
          />
        </div>
      </div>
    </Providers>
  ),
}

// Regression check: on mobile, typing in the description must not scroll the
// window. This renders through the real AppLayout (not FullPageSP's
// standalone mimic), since the bug lives in AppLayout's own root element:
// ProseMirror's cursor-into-view walk (run on every keystroke) stops at the
// first `fixed`/`sticky` ancestor, but AppLayout's root used to be a
// statically-positioned `h-screen` div, so the walk fell through every
// intermediate `overflow-auto` container (whose height doesn't shrink for an
// open on-screen keyboard) all the way to `document.body`. There, it *does*
// see the keyboard-shrunk `visualViewport` and calls `window.scrollBy` —
// jerking the whole page on every character.
export const TypingWithKeyboardOpenDoesNotScrollWindow: StoryObj<{
  task: TaskDetail
  pages: TaskPage[]
  subtasks: Task[]
  sessions: AgentSession[]
}> = {
  args: {
    task: { ...baseTask },
    pages: samplePages,
    subtasks: [],
    sessions: sampleSessions,
  },
  tags: ['mobile-only'],
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
    // Tests window-scroll behavior under a shrunk visualViewport, not
    // appearance.
    screenshot: { skip: true },
    // AppLayout also mounts Sidebar/BottomTabBar, which fetch these — same
    // handlers as app-layout.stories.tsx.
    msw: {
      handlers: [
        http.get('/api/tasks', () => HttpResponse.json([])),
        http.get('/api/projects', () => HttpResponse.json([])),
        http.get('/api/schedule/today-tasks', () => HttpResponse.json([])),
        http.get('/api/saved-views', () => HttpResponse.json([])),
        http.get('/api/labels', () => HttpResponse.json([])),
      ],
    },
  },
  render: ({ task, pages, subtasks, sessions }) => (
    <Providers>
      <AppLayout>
        <div className="flex h-full flex-col overflow-y-auto p-4">
          <TaskSidebarMobile task={task} />
          <div className="mt-4 border-t border-border pt-4">
            <TaskMainContent
              task={task}
              pages={pages}
              subtasks={subtasks}
              sessions={sessions}
            />
          </div>
        </div>
      </AppLayout>
    </Providers>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const proseMirrorRoot = assertDefined(
      // TaskDescription renders before TaskPagesList/TaskSubtasksList/
      // TaskActivity, so the first ProseMirror root in DOM order is the
      // description editor, not a comment box.
      canvasElement.querySelector('.milkdown .ProseMirror'),
      'the description editor always renders a ProseMirror root',
    )

    // First click flips the (view-mode) editor to edit mode; Crepe only
    // applies contenteditable in an effect that runs after that click, so a
    // second click is needed to actually focus it (see the same pattern in
    // markdown-editor.stories.tsx).
    await userEvent.click(proseMirrorRoot)
    await userEvent.click(proseMirrorRoot)

    const view = assertDefined(
      canvasElement.ownerDocument.defaultView,
      'a mounted story always has an owner window',
    )
    const visualViewport = assertDefined(
      view.visualViewport,
      'browsers used for storybook tests always provide visualViewport',
    )

    // Simulate the on-screen keyboard covering the bottom of the screen: the
    // visual viewport shrinks while the layout viewport (and this
    // h-screen-based layout) does not.
    spyOn(visualViewport, 'height', 'get').mockReturnValue(200)
    visualViewport.dispatchEvent(new Event('resize'))

    const scrollBySpy = spyOn(view, 'scrollBy').mockImplementation(() => {})

    await userEvent.keyboard('!')

    await expect(scrollBySpy).not.toHaveBeenCalled()
  },
}
