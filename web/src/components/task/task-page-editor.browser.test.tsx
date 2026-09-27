import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { PageEditorInner } from '#components/task/task-page-editor'
import { assertDefined } from '#lib/test-utils'

function renderPageEditor() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <PageEditorInner
        taskId="task-001"
        pageId="page-001"
        defaultTitle="Meeting Notes"
        defaultContent={
          '## Discussion Points\n\nThe editor starts in read mode.'
        }
        format="markdown"
      />
    </QueryClientProvider>,
  )
}

function getEditorState(container: HTMLElement) {
  const wrapper = assertDefined(
    container.querySelector<HTMLElement>('.milkdown-wrapper'),
    'the page has a MarkdownEditor wrapper',
  )
  const editor = assertDefined(
    container.querySelector<HTMLElement>('.milkdown .ProseMirror'),
    'the page has a ProseMirror editor root',
  )

  return {
    mode: wrapper.getAttribute('data-view-mode'),
    editorFocused: document.activeElement === editor,
  }
}

describe('PageEditorInner', () => {
  it('keeps the content in read mode when its body is clicked', async () => {
    const { container } = renderPageEditor()
    const user = userEvent.setup()

    await user.click(
      await screen.findByText('Discussion Points', {}, { timeout: 5000 }),
    )

    expect(getEditorState(container)).toEqual({
      mode: 'view',
      editorFocused: false,
    })
  })

  it('enters edit mode from the explicit edit button', async () => {
    const { container } = renderPageEditor()
    const user = userEvent.setup()
    await screen.findByText('Discussion Points', {}, { timeout: 5000 })

    await user.click(screen.getByRole('button', { name: 'edit' }))

    await waitFor(() => {
      expect(getEditorState(container)).toEqual({
        mode: 'edit',
        editorFocused: true,
      })
    })
  })
})
