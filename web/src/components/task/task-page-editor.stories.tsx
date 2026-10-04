import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { PageEditorInner } from '#components/task/task-page-editor'
import type { TaskPage } from '#hooks/use-task-pages'

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function Story({
  pageId,
  defaultTitle,
  defaultContent,
  format,
  defaultContentEditing,
}: {
  pageId: string
  defaultTitle: string
  defaultContent: string
  format: TaskPage['format']
  defaultContentEditing?: boolean
}) {
  return (
    <Providers>
      <div className="h-screen">
        <PageEditorInner
          taskId="task-001"
          pageId={pageId}
          defaultTitle={defaultTitle}
          defaultContent={defaultContent}
          format={format}
          {...(defaultContentEditing === undefined
            ? {}
            : { defaultContentEditing })}
        />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskPages/PageEditorInner',
  component: Story,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Story>

export default meta
type PageEditorStory = StoryObj<typeof meta>

export const Default: PageEditorStory = {
  name: 'the editor shows a populated markdown page',
  args: {
    pageId: 'page-001',
    defaultTitle: 'Meeting Notes',
    defaultContent:
      '## Discussion Points\n\n- Architecture review\n- Sprint planning\n- Performance improvements\n\nWe decided to go with option B for the following reasons:\n\n1. Better performance\n2. Simpler architecture\n3. Easier to maintain',
    format: 'markdown',
  },
  tags: ['desktop-only'],
}

export const Empty: PageEditorStory = {
  name: 'the editor shows an empty markdown page',
  args: {
    pageId: 'page-002',
    defaultTitle: 'Untitled',
    defaultContent: '',
    format: 'markdown',
  },
}

export const Editing: PageEditorStory = {
  name: 'the populated page is open for editing',
  args: {
    ...Default.args,
    defaultContentEditing: true,
  },
  tags: ['desktop-only'],
}

export const DefaultSP: PageEditorStory = {
  name: 'the populated page editor fits the mobile viewport',
  args: Default.args,
  tags: ['mobile-only'],
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
  },
}
