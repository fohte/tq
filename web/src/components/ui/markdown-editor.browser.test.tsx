import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { MarkdownEditor } from '#components/ui/markdown-editor'
import { assertDefined } from '#lib/test-utils'

// Must end in a blockquote, not a list: a list's own mount-time selection-sync
// transaction already masks the bug this fixture is meant to expose
// (@milkdown/plugin-trailing appending a paragraph on any transaction).
const TRAILING_BLOCKQUOTE_CONTENT =
  'Some intro text.\n\n> A blockquote at the very end.'

describe('MarkdownEditor size', () => {
  // Regression check: 'compact' (a few-lines inline editor, e.g. a
  // task/project description) must render its own min-height (120px) rather
  // than the 'default' size's 400px or collapsing to the content's own
  // height.
  it("renders the compact size's own min-height", async () => {
    const { container } = render(
      <MarkdownEditor placeholder="Write something..." size="compact" />,
    )
    await waitFor(() => {
      expect(container.querySelector('.milkdown-wrapper')).not.toBeNull()
    })

    const wrapper = assertDefined(
      container.querySelector('.milkdown-wrapper'),
      'MarkdownEditor always renders its wrapper',
    )
    const height = wrapper.getBoundingClientRect().height
    expect(height).toBeGreaterThanOrEqual(120)
    expect(height).toBeLessThan(200)
  })
})

describe('MarkdownEditor mode toggle', () => {
  it('does not autosave when switching mode without editing', async () => {
    const onChange = vi.fn()
    const { container } = render(
      <MarkdownEditor
        defaultValue={TRAILING_BLOCKQUOTE_CONTENT}
        viewEditToggle={{}}
        onChange={onChange}
      />,
    )
    await screen.findByText('Some intro text.')

    const wrapper = assertDefined(
      container.querySelector('.milkdown-wrapper'),
      'MarkdownEditor always renders its wrapper and root',
    )
    const proseMirrorRoot = assertDefined(
      container.querySelector('.milkdown .ProseMirror'),
      'MarkdownEditor always renders its wrapper and root',
    )
    const blockquote = assertDefined(
      container.querySelector('.milkdown .ProseMirror blockquote'),
      'editor always renders the blockquote',
    )
    const blockCountBefore = proseMirrorRoot.children.length

    const user = userEvent.setup()
    await user.click(blockquote)
    expect(wrapper).toHaveAttribute('data-view-mode', 'edit')

    // fireEvent (not userEvent.keyboard) targets the wrapper directly: the
    // click above flips the editor into edit mode, but Crepe only applies
    // contenteditable=true in a React effect that runs after that click
    // event has already finished, so the browser never focuses the (still
    // read-only at click time) DOM node — there'd be nothing for a
    // keyboard-targeted Escape to bubble up from.
    fireEvent.keyDown(wrapper, { key: 'Escape' })
    await waitFor(() =>
      expect(wrapper).toHaveAttribute('data-view-mode', 'view'),
    )

    expect(proseMirrorRoot.children.length).toBe(blockCountBefore)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('changes the document after entering edit mode and typing', async () => {
    const { container } = render(
      <MarkdownEditor
        defaultValue={TRAILING_BLOCKQUOTE_CONTENT}
        viewEditToggle={{}}
      />,
    )
    await screen.findByText('Some intro text.')

    const wrapper = assertDefined(
      container.querySelector('.milkdown-wrapper'),
      'MarkdownEditor always renders its wrapper',
    )
    const blockquote = assertDefined(
      container.querySelector('.milkdown .ProseMirror blockquote'),
      'editor always renders the blockquote',
    )

    const user = userEvent.setup()
    // A first click flips the editor into edit mode, but Crepe only applies
    // contenteditable=true in a React effect that runs after that click
    // event has already finished. A second click, now that it's actually
    // editable, gives it real focus so the following keystroke lands in the
    // document.
    await user.click(blockquote)
    await user.click(blockquote)
    await user.keyboard('!')

    await screen.findByText('A blockquote at the very end.!')

    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(wrapper).toHaveAttribute('data-view-mode', 'view'),
    )
    expect(
      screen.getByText('A blockquote at the very end.!'),
    ).toBeInTheDocument()
  })
})

// Simulates a `defaultValue` update arriving from outside the editor (e.g.
// another tab), without pulling in React Query and a real task/page fixture.
function ExternalUpdateHarness({
  initialValue,
  updatedValue,
}: {
  initialValue: string
  updatedValue: string
}) {
  const [value, setValue] = useState(initialValue)
  return (
    <>
      <button
        type="button"
        // Prevents moving focus to this button so the editor doesn't
        // blur/exit edit mode.
        onMouseDown={(e) => {
          e.preventDefault()
        }}
        onClick={() => {
          setValue(updatedValue)
        }}
      >
        simulate external update
      </button>
      <MarkdownEditor defaultValue={value} viewEditToggle={{}} />
    </>
  )
}

describe('MarkdownEditor external updates', () => {
  it('replaces content when an external update arrives in view mode', async () => {
    render(
      <ExternalUpdateHarness
        initialValue="Original content."
        updatedValue="Updated from another tab."
      />,
    )
    await screen.findByText('Original content.')

    const user = userEvent.setup()
    await user.click(
      screen.getByRole('button', { name: 'simulate external update' }),
    )

    await screen.findByText('Updated from another tab.')
    expect(screen.queryByText('Original content.')).not.toBeInTheDocument()
  })

  it('does not disrupt typing when an external update arrives mid-edit', async () => {
    const { container } = render(
      <ExternalUpdateHarness
        initialValue={TRAILING_BLOCKQUOTE_CONTENT}
        updatedValue="Overwritten from outside while editing."
      />,
    )
    await screen.findByText('Some intro text.')
    const blockquote = assertDefined(
      container.querySelector('.milkdown .ProseMirror blockquote'),
      'editor always renders the blockquote',
    )

    const user = userEvent.setup()
    await user.click(blockquote)
    await user.click(blockquote)
    await user.keyboard('!')

    await screen.findByText('A blockquote at the very end.!')

    await user.click(
      screen.getByRole('button', { name: 'simulate external update' }),
    )

    await screen.findByText('A blockquote at the very end.!')
    expect(
      screen.queryByText('Overwritten from outside while editing.'),
    ).not.toBeInTheDocument()
  })

  it('applies a deferred external update once Escape returns to view mode', async () => {
    const { container } = render(
      <ExternalUpdateHarness
        initialValue={TRAILING_BLOCKQUOTE_CONTENT}
        updatedValue="Overwritten from outside while editing."
      />,
    )
    await screen.findByText('Some intro text.')
    const wrapper = assertDefined(
      container.querySelector('.milkdown-wrapper'),
      'MarkdownEditor always renders its wrapper',
    )
    const blockquote = assertDefined(
      container.querySelector('.milkdown .ProseMirror blockquote'),
      'editor always renders the blockquote',
    )

    const user = userEvent.setup()
    await user.click(blockquote)
    await user.click(blockquote)
    await user.keyboard('!')

    await user.click(
      screen.getByRole('button', { name: 'simulate external update' }),
    )
    await user.keyboard('?')

    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(wrapper).toHaveAttribute('data-view-mode', 'view'),
    )

    await screen.findByText('Overwritten from outside while editing.')
    expect(
      screen.queryByText('A blockquote at the very end.!?'),
    ).not.toBeInTheDocument()
  })
})
