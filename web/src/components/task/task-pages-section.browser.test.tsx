import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PageCardPresentation } from '#components/task/page-card'
import { makeTaskPage } from '#components/task/task-page-test-fixtures'
import { TaskPagesSection } from '#components/task/task-pages-section'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import type { TaskPage } from '#hooks/use-task-pages'
import { assertDefined } from '#lib/test-utils'
import { createStoryRouter } from '#storybook-config/story-router'

const { getPages, getPage } = vi.hoisted(() => ({
  getPages: vi.fn(),
  getPage: vi.fn(),
}))

vi.mock('#lib/api', () => ({
  api: {
    api: {
      tasks: {
        ':taskId': {
          pages: {
            $get: getPages,
            ':pageId': { $get: getPage },
          },
        },
      },
    },
  },
}))

vi.mock('#components/ui/markdown-editor', async () => {
  const { useState } = await import('react')

  return {
    MarkdownEditor: ({
      defaultValue = '',
      editing,
    }: {
      defaultValue?: string
      editing?: boolean
    }) => {
      const [value, setValue] = useState(defaultValue)

      return (
        <div
          className="milkdown-wrapper"
          data-view-mode={editing === true ? 'edit' : 'view'}
        >
          <textarea
            aria-label="Page editor"
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
            }}
          />
          {value.split('\n').map((line, index) => (
            <p key={index}>{line.replace(/^#+\s*/, '')}</p>
          ))}
        </div>
      )
    },
  }
})

beforeEach(() => {
  getPages.mockReset()
  getPage.mockReset()
})

function pageEditorLoadResult<TRequests>(
  body: string | null,
  requests: TRequests,
) {
  return { body, singlePageRequests: requests }
}

function pageEditorRefetchResult(
  value: string,
  listFetches: number,
  bodyFetches: number,
) {
  return { value, listFetches, bodyFetches }
}

async function renderPageCard({
  page = makeTaskPage(),
  isExpanded,
  isDeleting = false,
  onDelete = vi.fn(),
}: {
  page?: TaskPage
  isExpanded?: boolean
  isDeleting?: boolean
  onDelete?: () => void
} = {}) {
  const router = createStoryRouter({
    component: () => (
      <PageCardPresentation
        taskId={page.taskId}
        page={page}
        expandedContent={page.content}
        onDelete={onDelete}
        isDeleting={isDeleting}
        {...(isExpanded === undefined ? {} : { isExpanded })}
        renderEditor={(defaultValue, { editing, onEditingChange }) => (
          <MarkdownEditor
            defaultValue={defaultValue}
            editing={editing}
            onEditingChange={onEditingChange}
            size="compact"
          />
        )}
      />
    ),
    paths: ['/tasks/$taskId/pages/$pageId'],
  })
  await router.load()

  return {
    ...render(<RouterProvider router={router} />),
  }
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function renderTaskPagesSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createStoryRouter({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <TaskPagesSection taskId="task-001" />
      </QueryClientProvider>
    ),
    paths: ['/tasks/$taskId/pages/$pageId'],
  })
  await router.load()

  return {
    ...render(<RouterProvider router={router} />),
    queryClient,
  }
}

async function openPageActions(container: HTMLElement) {
  const user = userEvent.setup()
  const trigger = assertDefined(
    container.querySelector<HTMLElement>('[data-slot="dropdown-menu-trigger"]'),
    'desktop actions trigger not found',
  )
  await user.click(trigger)
  return user
}

function getCardEditorState(container: HTMLElement) {
  const wrapper = assertDefined(
    container.querySelector<HTMLElement>('.milkdown-wrapper'),
    'the expanded page has a MarkdownEditor wrapper',
  )

  return {
    expanded: screen.queryByRole('button', { name: 'Collapse' }) != null,
    mode: wrapper.getAttribute('data-view-mode'),
  }
}

function getDeleteState(deleteCalls: number) {
  return {
    confirmationOpen:
      screen.queryByRole('heading', { name: 'Delete page' }) != null,
    deleteCalls,
  }
}

function getAvailablePageActions() {
  return {
    edit: screen.queryByText('edit') != null,
    delete: screen.queryByText('delete…') != null,
  }
}

describe('PageCardPresentation', () => {
  it('expands into edit mode when edit is selected from the page actions', async () => {
    const { container } = await renderPageCard()
    const user = await openPageActions(container)

    await user.click(await screen.findByText('edit'))
    await screen.findByText('Discussion Points', {}, { timeout: 5000 })

    expect(getCardEditorState(container)).toEqual({
      expanded: true,
      mode: 'edit',
    })
  })

  it('uses only the summary preview for a collapsed card', async () => {
    const page = makeTaskPage({
      content: 'This body is not the preview.',
      preview: 'This is the preview.',
      contentTruncated: true,
    })
    await renderPageCard({ page })

    expect(
      screen.getByText('This is the preview.').parentElement?.textContent,
    ).toEqual('This is the preview.show more')
  })

  it('loads the full body from the single-page endpoint when the card expands', async () => {
    const page = makeTaskPage({
      content: 'The list body is not used for editing.',
      preview: '## Short list preview',
      contentTruncated: false,
    })
    const fullPage = makeTaskPage({
      content:
        '## Full body from the single-page endpoint\n\nLoaded in the editor.',
    })
    getPages.mockImplementation(() => jsonResponse([page]))
    getPage.mockImplementation(() => jsonResponse(fullPage))
    const user = userEvent.setup()
    await renderTaskPagesSection()

    await user.click(await screen.findByRole('button', { name: 'Expand' }))
    const bodyHeading = await screen.findByText(
      'Full body from the single-page endpoint',
      {},
      { timeout: 5000 },
    )

    expect(
      pageEditorLoadResult(bodyHeading.textContent, getPage.mock.calls),
    ).toEqual({
      body: 'Full body from the single-page endpoint',
      singlePageRequests: [
        [{ param: { taskId: 'task-001', pageId: 'page-001' } }],
      ],
    })
  })

  it('keeps edited input when the page list and body queries refetch', async () => {
    const page = makeTaskPage({
      content: 'The list body is not used for editing.',
      preview: '## Short list preview',
      contentTruncated: false,
    })
    const fullPage = makeTaskPage({
      content: '## Original body from the endpoint',
    })
    getPages.mockImplementation(() => jsonResponse([page]))
    getPage.mockImplementation(() => jsonResponse(fullPage))
    const user = userEvent.setup()
    const { container, queryClient } = await renderTaskPagesSection()
    await screen.findByRole('button', { name: 'Expand' })
    const userWithActions = await openPageActions(container)

    await userWithActions.click(await screen.findByText('edit'))
    const editor = await screen.findByRole('textbox', { name: 'Page editor' })
    await user.clear(editor)
    await user.type(editor, 'Unsaved draft')

    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: ['tasks', 'detail', 'task-001', 'pages'],
        exact: true,
      })
      await queryClient.invalidateQueries({
        queryKey: ['tasks', 'detail', 'task-001', 'pages', 'page-001'],
        exact: true,
      })
    })

    const pageTextArea = assertDefined(
      container.querySelector<HTMLTextAreaElement>(
        'textarea[aria-label="Page editor"]',
      ),
    )
    expect(
      pageEditorRefetchResult(
        pageTextArea.value,
        getPages.mock.calls.length,
        getPage.mock.calls.length,
      ),
    ).toEqual({
      value: 'Unsaved draft',
      listFetches: 2,
      bodyFetches: 2,
    })
  })

  it('keeps the page in read mode when its body is clicked', async () => {
    const { container } = await renderPageCard({ isExpanded: true })
    const user = userEvent.setup()
    await user.click(
      await screen.findByText('Discussion Points', {}, { timeout: 5000 }),
    )

    expect(getCardEditorState(container)).toEqual({
      expanded: true,
      mode: 'view',
    })
  })

  it('does not offer edit for HTML pages', async () => {
    const { container } = await renderPageCard({
      page: makeTaskPage({ format: 'html' }),
    })
    await openPageActions(container)

    await screen.findByText('delete…')

    expect(getAvailablePageActions()).toEqual({ edit: false, delete: true })
  })

  it('hides delete while a page deletion is pending', async () => {
    const { container } = await renderPageCard({ isDeleting: true })
    await openPageActions(container)

    await screen.findByText('edit')

    expect(getAvailablePageActions()).toEqual({ edit: true, delete: false })
  })

  it('deletes the page only after the confirmation is accepted', async () => {
    const onDelete = vi.fn()
    const { container } = await renderPageCard({ onDelete })
    const user = await openPageActions(container)

    await user.click(await screen.findByText('delete…'))
    await screen.findByRole('heading', { name: 'Delete page' })
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(getDeleteState(onDelete.mock.calls.length)).toEqual({
        confirmationOpen: false,
        deleteCalls: 1,
      })
    })
  })
})
