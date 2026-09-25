import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Fragment, useState } from 'react'

import { makeSavedView } from '#components/layout/sidebar-test-fixtures'
import { makeProject } from '#components/project/project-test-fixtures'
import {
  createPageItems,
  createProjectItems,
  createViewItems,
  type ListItem,
  renderTaskOption,
} from '#components/search/search-modal-result-items'
import { makePageSearchResult } from '#components/search/search-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { StoryRouter } from '#storybook-config/story-router'

type ResultKind =
  | 'task'
  | 'project'
  | 'view'
  | 'page'
  | 'taskLongTitle'
  | 'projectLongTitle'
  | 'pageLongContent'

interface SearchModalResultItemStoryProps {
  kind: ResultKind
  isSelected: boolean
}

const task = makeTask({
  id: 'task-story',
  number: 12,
  title: 'Prepare the weekly review',
  context: 'work',
  estimatedMinutes: 30,
})
const taskLongTitle = makeTask({
  id: 'task-long-title-story',
  number: 14,
  title:
    'Review the customer onboarding flow across account and workspace configurations',
  context: 'work',
})
const noop = () => undefined
const taskOnOpenChangeRef = { current: noop }
const pageOnOpenChangeRef = { current: noop }

const itemsByKind: Record<ResultKind, ListItem[]> = {
  task: [
    {
      key: task.id,
      select: noop,
      render: renderTaskOption(task, taskOnOpenChangeRef),
    },
  ],
  taskLongTitle: [
    {
      key: taskLongTitle.id,
      select: noop,
      render: renderTaskOption(taskLongTitle, taskOnOpenChangeRef),
    },
  ],
  project: createProjectItems(
    [makeProject({ id: 'project-story', title: 'Website refresh' })],
    noop,
  ),
  projectLongTitle: createProjectItems(
    [
      makeProject({
        id: 'project-long-title-story',
        title:
          'Coordinate the customer onboarding redesign across product and support teams',
      }),
    ],
    noop,
  ),
  view: createViewItems(
    [makeSavedView({ id: 'view-story', name: 'Recently updated' })],
    noop,
  ),
  page: createPageItems(
    [
      makePageSearchResult({
        taskNumber: 12,
        taskTitle: 'Prepare the weekly review',
        pageId: 'page-story',
        pageTitle: 'Release checklist',
        snippet: 'Review the rollout steps before the next release.',
      }),
    ],
    noop,
    pageOnOpenChangeRef,
  ),
  pageLongContent: createPageItems(
    [
      makePageSearchResult({
        taskNumber: 14,
        taskTitle:
          'Review onboarding behavior for new users across projects and saved views',
        pageId: 'page-long-content-story',
        pageTitle:
          'Implementation notes for the redesigned onboarding and account configuration workflow',
        snippet:
          'The page records how the redesigned onboarding flow guides new users through account setup, project selection, saved views, and the first task creation. It also lists the empty states and validation messages that need to remain consistent while the workflow loads data and moves between sections. The release checklist covers keyboard navigation, narrow viewport layout, and recovery when a step cannot be completed.',
      }),
    ],
    noop,
    pageOnOpenChangeRef,
  ),
}

function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId', '/tasks/$taskId/pages/$pageId']}
      />
    </QueryClientProvider>
  )
}

function SearchModalResultItemStory({
  kind,
  isSelected,
}: SearchModalResultItemStoryProps) {
  return (
    <Providers>
      <div className="w-full max-w-160 bg-popover text-popover-foreground">
        <div className="py-2" role="listbox" aria-label="Search results">
          {itemsByKind[kind].map((item) => (
            <Fragment key={item.key}>
              {item.render({
                isSelected,
                onMouseMove: () => {},
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Search/SearchModalResultItems',
  component: SearchModalResultItemStory,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof SearchModalResultItemStory>

export default meta
type Story = StoryObj<typeof meta>

export const Task: Story = {
  name: 'a task result shows its title and task number',
  args: { kind: 'task', isSelected: false },
}

export const Project: Story = {
  name: 'a project result shows its name',
  args: { kind: 'project', isSelected: false },
}

export const View: Story = {
  name: 'a saved view result shows its name',
  args: { kind: 'view', isSelected: false },
}

export const Page: Story = {
  name: 'a page result shows its title and matching snippet',
  args: { kind: 'page', isSelected: false },
}

export const LongTaskTitle: Story = {
  name: 'a long task title wraps within its search result',
  args: { kind: 'taskLongTitle', isSelected: false },
}

export const LongProjectTitle: Story = {
  name: 'a long project name wraps within its search result',
  args: { kind: 'projectLongTitle', isSelected: false },
}

export const LongPageContent: Story = {
  name: 'a page result clips a long title and matching snippet',
  args: { kind: 'pageLongContent', isSelected: false },
}

export const SelectedTask: Story = {
  name: 'a task result is highlighted for keyboard selection',
  args: { kind: 'task', isSelected: true },
}

export const SelectedProject: Story = {
  name: 'a project result is highlighted for keyboard selection',
  args: { kind: 'project', isSelected: true },
}

export const SelectedView: Story = {
  name: 'a saved view result is highlighted for keyboard selection',
  args: { kind: 'view', isSelected: true },
}

export const SelectedPage: Story = {
  name: 'a page result is highlighted for keyboard selection',
  args: { kind: 'page', isSelected: true },
}
