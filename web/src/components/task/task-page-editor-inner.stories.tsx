import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { PageEditorInner } from '#components/task/task-page-editor-inner'
import { BackLink } from '#components/ui/back-header-bar'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import type { TaskPageBody } from '#hooks/use-task-pages'
import { StoryRouter } from '#storybook-config/story-router'

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId']}
      />
    </QueryClientProvider>
  )
}

function SubpageViewPresentation({
  taskId,
  pageTitle,
  children,
}: {
  taskId: string
  pageTitle: string
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full flex-col">
      <ScreenHeaderBar>
        <BackLink to="/tasks/$taskId" params={{ taskId }} aria-label="Back" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-foreground">
          {pageTitle}
        </span>
      </ScreenHeaderBar>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}

function Story({
  taskId,
  pageId,
  defaultTitle,
  defaultContent,
  format,
  defaultContentEditing,
}: {
  taskId: string
  pageId: string
  defaultTitle: string
  defaultContent: string
  format: TaskPageBody['format']
  defaultContentEditing?: boolean
}) {
  return (
    <Providers>
      <div className="h-screen">
        <SubpageViewPresentation taskId={taskId} pageTitle={defaultTitle}>
          <PageEditorInner
            taskId={taskId}
            pageId={pageId}
            defaultTitle={defaultTitle}
            defaultContent={defaultContent}
            format={format}
            {...(defaultContentEditing === undefined
              ? {}
              : { defaultContentEditing })}
          />
        </SubpageViewPresentation>
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskPages/SubpageView',
  component: Story,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Story>

export default meta
type SubpageStory = StoryObj<typeof meta>

export const Default: SubpageStory = {
  name: 'the editor shows a populated markdown page',
  args: {
    taskId: 'task-001',
    pageId: 'page-001',
    defaultTitle: 'Meeting Notes',
    defaultContent:
      '## Discussion Points\n\n- Architecture review\n- Sprint planning\n- Performance improvements\n\nWe decided to go with option B for the following reasons:\n\n1. Better performance\n2. Simpler architecture\n3. Easier to maintain',
    format: 'markdown',
  },
  tags: ['desktop-only'],
}

export const Empty: SubpageStory = {
  name: 'the editor shows an empty markdown page',
  args: {
    taskId: 'task-001',
    pageId: 'page-002',
    defaultTitle: 'Untitled',
    defaultContent: '',
    format: 'markdown',
  },
}

export const Editing: SubpageStory = {
  name: 'the populated page is open for editing',
  args: {
    ...Default.args,
    defaultContentEditing: true,
  },
  tags: ['desktop-only'],
}

export const DefaultSP: SubpageStory = {
  name: 'the populated page editor fits the mobile viewport',
  args: Default.args,
  tags: ['mobile-only'],
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
  },
}
