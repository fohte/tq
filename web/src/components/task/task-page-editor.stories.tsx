import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import {
  PageEditorInner,
  SubpageViewPresentation,
} from '#components/task/task-page-editor'
import type { TaskPage } from '#hooks/use-task-pages'
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

function Story({
  taskId,
  pageId,
  defaultTitle,
  defaultContent,
  format,
}: {
  taskId: string
  pageId: string
  defaultTitle: string
  defaultContent: string
  format: TaskPage['format']
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
  args: {
    taskId: 'task-001',
    pageId: 'page-001',
    defaultTitle: 'Meeting Notes',
    defaultContent:
      '## Discussion Points\n\n- Architecture review\n- Sprint planning\n- Performance improvements\n\nWe decided to go with option B for the following reasons:\n\n1. Better performance\n2. Simpler architecture\n3. Easier to maintain',
    format: 'markdown',
  },
}

export const Empty: SubpageStory = {
  args: {
    taskId: 'task-001',
    pageId: 'page-002',
    defaultTitle: 'Untitled',
    defaultContent: '',
    format: 'markdown',
  },
}

export const DefaultSP: SubpageStory = {
  args: Default.args,
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
  },
}
