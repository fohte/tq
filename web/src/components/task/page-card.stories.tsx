import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { PageCardPresentation } from '#components/task/page-card'
import { makeAuthorInfo } from '#components/task/task-author-test-fixtures'
import {
  makeTaskPage,
  makeTaskPageBody,
} from '#components/task/task-page-test-fixtures'
import { HtmlPageEditor } from '#components/ui/html-page-editor'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import type { TaskPage } from '#hooks/use-task-pages'
import { StoryRouter } from '#storybook-config/story-router'

const samplePage = makeTaskPage()
const samplePageBody = makeTaskPageBody()
const htmlPageContent =
  '<!doctype html><html><body style="font-family: sans-serif; margin: 0; padding: 16px;"><h1>Dashboard</h1></body></html>'

const emptyPage = makeTaskPage({
  id: 'page-003',
  title: 'Empty Page',
  preview: '',
  sortOrder: 2,
  createdAt: '2026-03-22T00:00:00.000Z',
  updatedAt: '2026-03-22T00:00:00.000Z',
})

const htmlPage = makeTaskPage({
  id: 'page-004',
  title: 'Dashboard Mockup',
  format: 'html',
  preview: null,
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
  bodyState = 'loaded',
  isDeleting = false,
  defaultEditing,
  defaultActionsMenuOpen,
  deleteDialogOpen,
}: {
  page: TaskPage
  isExpanded: boolean
  bodyState?: 'loaded' | 'loading' | 'error'
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
          expandedContent={
            bodyState === 'loaded'
              ? page.format === 'html'
                ? htmlPageContent
                : samplePageBody.content
              : undefined
          }
          contentLoadError={bodyState === 'error'}
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
    page: {
      ...samplePage,
      author: makeAuthorInfo({ kind: 'llm', agent: 'sample-agent' }),
    },
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

export const TruncatedPreview: CardStory = {
  name: 'the card offers to show more when its preview is truncated',
  args: {
    page: makeTaskPage({
      preview: '## Discussion Points\n\n- Architecture review',
      contentTruncated: true,
    }),
    isExpanded: false,
    defaultEditing: false,
    deleteDialogOpen: false,
  },
}

export const LoadingBody: CardStory = {
  name: 'the expanded card waits for the page body to load',
  args: {
    page: samplePage,
    isExpanded: true,
    bodyState: 'loading',
    defaultEditing: false,
    deleteDialogOpen: false,
  },
}

export const BodyLoadError: CardStory = {
  name: 'the expanded card shows an error when its body cannot be loaded',
  args: {
    page: samplePage,
    isExpanded: true,
    bodyState: 'error',
    defaultEditing: false,
    deleteDialogOpen: false,
  },
}
