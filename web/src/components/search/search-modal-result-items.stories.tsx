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

type ResultKind = 'task' | 'project' | 'view' | 'page'

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
  project: createProjectItems(
    [makeProject({ id: 'project-story', title: 'Website refresh' })],
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
  args: { kind: 'task', isSelected: false },
}

export const Project: Story = {
  args: { kind: 'project', isSelected: false },
}

export const View: Story = {
  args: { kind: 'view', isSelected: false },
}

export const Page: Story = {
  args: { kind: 'page', isSelected: false },
}

export const SelectedTask: Story = {
  args: { kind: 'task', isSelected: true },
}

export const SelectedProject: Story = {
  args: { kind: 'project', isSelected: true },
}

export const SelectedView: Story = {
  args: { kind: 'view', isSelected: true },
}

export const SelectedPage: Story = {
  args: { kind: 'page', isSelected: true },
}
