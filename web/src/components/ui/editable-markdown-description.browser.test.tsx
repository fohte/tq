import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { EditableMarkdownDescription } from '#components/ui/editable-markdown-description'
import { assertDefined, findEditorText } from '#lib/test-utils'

function renderDescription(
  defaultValue: string | null,
  variant: 'task' | 'inline' = 'task',
) {
  return render(
    <EditableMarkdownDescription
      defaultValue={defaultValue}
      variant={variant}
      placeholder="Add description..."
      editButtonLabel="Edit description"
      onChange={() => {}}
      onExitEditMode={() => {}}
    />,
  )
}

function getEditorMode(container: HTMLElement) {
  const editor = assertDefined(
    container.querySelector('.milkdown-wrapper'),
    'the description renders a Markdown editor',
  )
  return editor.getAttribute('data-view-mode')
}

describe('EditableMarkdownDescription', () => {
  it('opens a populated description from the edit button', async () => {
    const user = userEvent.setup()
    const { container } = renderDescription('A sample description.')
    await screen.findByText('A sample description.', {}, { timeout: 20_000 })

    await user.click(screen.getByRole('button', { name: 'Edit description' }))

    await waitFor(() => {
      expect(getEditorMode(container)).toBe('edit')
    })
  }, 25_000)

  it('keeps a populated description in view mode when its body is clicked', async () => {
    const user = userEvent.setup()
    const { container } = renderDescription('A sample description.')
    const paragraph = await findEditorText('A sample description.')

    await user.click(paragraph)

    expect(getEditorMode(container)).toBe('view')
  })

  it('opens a populated inline description when its body is clicked', async () => {
    const user = userEvent.setup()
    const { container } = renderDescription(
      'A sample wait description.',
      'inline',
    )
    const paragraph = await findEditorText('A sample wait description.')

    await user.click(paragraph)

    await waitFor(() => {
      const readActual = () => ({ mode: getEditorMode(container) })
      expect(readActual()).toEqual({ mode: 'edit' })
    })
  })

  it('opens an empty description when its placeholder is clicked', async () => {
    const user = userEvent.setup()
    const { container } = renderDescription(null)
    const paragraph = await waitFor(
      () =>
        assertDefined(
          container.querySelector('.milkdown .ProseMirror p'),
          'the empty description renders its placeholder paragraph',
        ),
      { timeout: 10_000 },
    )

    await user.click(paragraph)

    await waitFor(() => {
      expect(getEditorMode(container)).toBe('edit')
    })
  })
})
