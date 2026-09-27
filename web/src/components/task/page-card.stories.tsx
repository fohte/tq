import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { makeTaskPage } from '#components/task/task-page-test-fixtures'
import { PageCardPresentation } from '#components/task/task-pages-section'
import { HtmlPageEditor } from '#components/ui/html-page-editor'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import type { TaskPage } from '#hooks/use-task-pages'
import { StoryRouter } from '#storybook-config/story-router'

const samplePage = makeTaskPage()

const emptyPage = makeTaskPage({
  id: 'page-003',
  title: 'Empty Page',
  content: '',
  sortOrder: 2,
  createdAt: '2026-03-22T00:00:00.000Z',
  updatedAt: '2026-03-22T00:00:00.000Z',
})

const htmlPage = makeTaskPage({
  id: 'page-004',
  title: 'Dashboard Mockup',
  content:
    '<!doctype html><html><body style="font-family: sans-serif; margin: 0; padding: 16px;"><h1>Dashboard</h1></body></html>',
  format: 'html',
  sortOrder: 3,
  createdAt: '2026-03-23T00:00:00.000Z',
  updatedAt: '2026-03-23T00:00:00.000Z',
})

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId/pages/$pageId']}
      />
    </QueryClientProvider>
  )
}

function Story({
  page,
  isExpanded,
  isDeleting = false,
  defaultEditing,
  defaultActionsMenuOpen,
  deleteDialogOpen,
}: {
  page: TaskPage
  isExpanded: boolean
  isDeleting?: boolean
  defaultEditing: boolean
  defaultActionsMenuOpen?: 'desktop' | 'mobile' | undefined
  deleteDialogOpen: boolean
}) {
  return (
    <Providers>
      <div className="max-w-2xl p-6">
        <PageCardPresentation
          taskId={page.taskId}
          page={page}
          onDelete={() => {}}
          isExpanded={isExpanded}
          isDeleting={isDeleting}
          defaultEditing={defaultEditing}
          defaultActionsMenuOpen={defaultActionsMenuOpen}
          deleteDialogOpen={deleteDialogOpen}
          renderEditor={(defaultValue, { editing, onEditingChange }) =>
            page.format === 'html' ? (
              <div className="text-sm">
                <HtmlPageEditor defaultValue={defaultValue} />
              </div>
            ) : (
              <div className="text-sm">
                <MarkdownEditor
                  defaultValue={defaultValue}
                  placeholder="Write something..."
                  editing={editing}
                  onEditingChange={onEditingChange}
                  viewEditToggle={{}}
                  size="compact"
                />
              </div>
            )
          }
        />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskPages/PageCard',
  component: Story,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof Story>

export default meta
type CardStory = StoryObj<typeof meta>

export const Collapsed: CardStory = {
  name: 'the card shows a page title with its content collapsed',
  args: {
    page: samplePage,
    isExpanded: false,
    defaultEditing: false,
    deleteDialogOpen: false,
  },
}

export const Expanded: CardStory = {
  name: 'the card shows its content in read mode',
  args: {
    page: samplePage,
    isExpanded: true,
    defaultEditing: false,
    deleteDialogOpen: false,
  },
}

export const ExpandedEditing: CardStory = {
  name: 'the card shows its content in edit mode',
  args: {
    page: samplePage,
    isExpanded: true,
    defaultEditing: true,
    deleteDialogOpen: false,
  },
}

export const ActionsMenuOpen: CardStory = {
  name: 'the card shows the page actions menu',
  args: {
    page: samplePage,
    isExpanded: false,
    defaultEditing: false,
    defaultActionsMenuOpen: 'desktop',
    deleteDialogOpen: false,
  },
  tags: ['desktop-only'],
}

export const ActionsMenuOpenSP: CardStory = {
  name: 'the card shows the page actions sheet on mobile',
  args: {
    page: samplePage,
    isExpanded: false,
    defaultEditing: false,
    defaultActionsMenuOpen: 'mobile',
    deleteDialogOpen: false,
  },
  tags: ['mobile-only'],
}

export const HtmlActionsMenuOpen: CardStory = {
  name: 'the HTML page actions menu offers deletion without an edit action',
  args: {
    page: htmlPage,
    isExpanded: false,
    defaultEditing: false,
    defaultActionsMenuOpen: 'desktop',
    deleteDialogOpen: false,
  },
  tags: ['desktop-only'],
}

export const DeletePending: CardStory = {
  name: 'the page actions menu hides deletion while a delete is pending',
  args: {
    page: samplePage,
    isExpanded: false,
    isDeleting: true,
    defaultEditing: false,
    defaultActionsMenuOpen: 'desktop',
    deleteDialogOpen: false,
  },
  tags: ['desktop-only'],
}

export const DeleteConfirmation: CardStory = {
  name: 'the card shows a confirmation prompt before deleting the page',
  args: {
    page: samplePage,
    isExpanded: false,
    defaultEditing: false,
    deleteDialogOpen: true,
  },
}

export const EmptyContent: CardStory = {
  name: 'the card has no page content to preview',
  args: {
    page: emptyPage,
    isExpanded: false,
    defaultEditing: false,
    deleteDialogOpen: false,
  },
}

export const LlmAuthored: CardStory = {
  name: 'the collapsed card marks the page as AI-authored',
  args: {
    page: { ...samplePage, author: { kind: 'llm', agent: 'claude-opus-5' } },
    isExpanded: false,
    defaultEditing: false,
    deleteDialogOpen: false,
  },
}

export const HtmlCollapsed: CardStory = {
  name: 'the card shows an HTML page with its content collapsed',
  args: {
    page: htmlPage,
    isExpanded: false,
    defaultEditing: false,
    deleteDialogOpen: false,
  },
}

export const HtmlExpanded: CardStory = {
  name: 'the card expands an HTML page inside the editor',
  args: {
    page: htmlPage,
    isExpanded: true,
    defaultEditing: false,
    deleteDialogOpen: false,
  },
}
