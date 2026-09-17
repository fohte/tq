import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { MarkdownEditor } from '#components/ui/markdown-editor'
import { assertDefined, waitForFocus } from '#lib/test-utils'

const TWO_ITEM_LIST = '- First item\n- Second item'
const NESTED_LIST = '- First item\n  - Nested item'

// Puts the caret at the start of `element`'s text. Click-count based
// selection (`tripleClick`) can't: the browser only groups clicks into a
// triple click when they arrive close enough together, and otherwise
// degrades to a double click — a word selection mid-paragraph.
async function placeCaretAtStart(
  element: HTMLElement,
  user: UserEvent,
): Promise<void> {
  const doc = element.ownerDocument
  const editor = assertDefined(
    element.closest<HTMLElement>('.ProseMirror'),
    'editor content always lives inside .ProseMirror',
  )

  // Keystrokes only reach ProseMirror once the wrapper's mouseup has taken
  // the editor out of its initial read-only mode.
  fireEvent.mouseUp(element, { button: 0 })
  await waitFor(() => {
    expect(editor.isContentEditable).toBe(true)
  })
  // Only here to focus ProseMirror.
  await user.click(element)
  await waitForFocus(editor)

  const textNode = assertDefined(
    doc.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode(),
    'a list item paragraph always renders its text',
  )
  const selection = assertDefined(
    doc.getSelection(),
    'a rendered document always has a selection',
  )
  const isAtStart = () =>
    selection.isCollapsed &&
    selection.anchorNode === textNode &&
    selection.anchorOffset === 0
  if (isAtStart()) return

  // ProseMirror re-syncs the DOM selection from its own state on every
  // `selectionchange`, which can overwrite the caret we just set — keep
  // re-asserting it here until a round leaves it at the start.
  let caretTaken = false
  const onSelectionChange = () => {
    if (!isAtStart()) {
      selection.collapse(textNode, 0)
      return
    }
    doc.removeEventListener('selectionchange', onSelectionChange)
    setTimeout(() => {
      caretTaken = true
    })
  }
  doc.addEventListener('selectionchange', onSelectionChange)
  selection.collapse(textNode, 0)
  await waitFor(() => {
    expect(caretTaken, 'ProseMirror never took the caret').toBe(true)
  }).finally(() => {
    doc.removeEventListener('selectionchange', onSelectionChange)
  })
}

describe('MarkdownEditor list indent keymap', () => {
  it('indents the second item when Space is pressed at its start', async () => {
    const { container } = render(
      <MarkdownEditor defaultValue={TWO_ITEM_LIST} viewEditToggle={{}} />,
    )
    const user = userEvent.setup()
    const secondItem = await screen.findByText('Second item')
    await placeCaretAtStart(secondItem, user)
    await user.keyboard(' ')

    // Trim whitespace-only text nodes added by Crepe's list-item DOM wrappers.
    await waitFor(() => {
      const nestedItem = assertDefined(
        container.querySelector('.milkdown .ProseMirror li li'),
        'Space at a list item start sinks it into a nested list',
      )
      expect(nestedItem.textContent.trim()).toBe('Second item')
    })
  })

  // The first item in a list has no previous sibling to nest under, so
  // sinkListItem can't indent it — Space must fall through to a normal space
  // character instead of being swallowed.
  it('types a space at the first list item start instead of indenting', async () => {
    const { container } = render(
      <MarkdownEditor defaultValue={TWO_ITEM_LIST} viewEditToggle={{}} />,
    )
    const user = userEvent.setup()
    const firstItem = await screen.findByText('First item')
    await placeCaretAtStart(firstItem, user)
    await user.keyboard(' ')

    // The accessible-text query (screen.findByText) normalizes away the
    // leading space this asserts on, so this reads the paragraph's raw text
    // directly instead.
    const firstParagraph = assertDefined(
      container.querySelector('.milkdown .ProseMirror p'),
      'the list always renders its first item as a paragraph',
    )
    expect(firstParagraph.textContent).toBe(' First item')
    expect(container.querySelector('.milkdown .ProseMirror li li')).toBeNull()
  })

  it('outdents a nested list item when Backspace is pressed at its start', async () => {
    const { container } = render(
      <MarkdownEditor defaultValue={NESTED_LIST} viewEditToggle={{}} />,
    )
    const user = userEvent.setup()
    const nestedItem = await screen.findByText('Nested item')
    await placeCaretAtStart(nestedItem, user)
    await user.keyboard('{Backspace}')

    await waitFor(() => {
      expect(container.querySelector('.milkdown .ProseMirror li li')).toBeNull()
    })
    await expect(screen.findByText('Nested item')).resolves.toBeVisible()
  })

  // A top-level item has no outer list to outdent into, so Backspace keeps
  // joining with the previous item instead.
  it('joins a top-level list item with the previous item on Backspace', async () => {
    const { container } = render(
      <MarkdownEditor defaultValue={TWO_ITEM_LIST} viewEditToggle={{}} />,
    )
    const user = userEvent.setup()
    const secondItem = await screen.findByText('Second item')
    await placeCaretAtStart(secondItem, user)
    await user.keyboard('{Backspace}')

    // joinBackward keeps both texts as separate paragraphs within one list item.
    await waitFor(() => {
      const topLevelItems = container.querySelectorAll(
        '.milkdown .ProseMirror > ul > .milkdown-list-item-block',
      )
      expect(topLevelItems).toHaveLength(1)
    })
    await expect(screen.findByText('First item')).resolves.toBeVisible()
    await expect(screen.findByText('Second item')).resolves.toBeVisible()
  })
})
