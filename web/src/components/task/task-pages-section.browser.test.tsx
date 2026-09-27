import { RouterProvider } from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { makeTaskPage } from '#components/task/task-page-test-fixtures'
import { PageCardPresentation } from '#components/task/task-pages-section'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import type { TaskPage } from '#hooks/use-task-pages'
import { assertDefined } from '#lib/test-utils'
import { createStoryRouter } from '#storybook-config/story-router'

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
        onDelete={onDelete}
        isDeleting={isDeleting}
        {...(isExpanded === undefined ? {} : { isExpanded })}
        renderEditor={(defaultValue, { editing, onEditingChange }) => (
          <MarkdownEditor
            defaultValue={defaultValue}
            editing={editing}
            onEditingChange={onEditingChange}
            viewEditToggle={{}}
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
