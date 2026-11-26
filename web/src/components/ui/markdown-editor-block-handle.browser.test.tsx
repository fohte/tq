import { fireEvent, render, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MarkdownEditor } from '#components/ui/markdown-editor'
import { assertDefined } from '#lib/test-utils'

const HOVER_TARGET_TEXT = 'Hover this paragraph to reveal its block handle.'

// BlockProvider binds its hover listener asynchronously and throttles
// pointermove; wait for the handle before hovering.
async function hoverToRevealBlockHandle(
  container: HTMLElement,
): Promise<Element> {
  const paragraph = await within(container).findByText(HOVER_TARGET_TEXT)

  const handle = await waitFor(() =>
    assertDefined(
      document.querySelector('.milkdown-block-handle'),
      'BlockEdit mounts its handle element in a requestAnimationFrame',
    ),
  )
  const rect = paragraph.getBoundingClientRect()
  fireEvent.pointerMove(paragraph, {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  })
  await waitFor(() => expect(handle).toHaveAttribute('data-show', 'true'))
  return handle
}

describe('MarkdownEditor block handle', () => {
  // Regression check: the handle spends its parent card's own padding (see
  // markdown-editor-crepe.tsx) before overlapping the block's text, so it
  // must never render further left than that card's edge.
  it("stays inside the parent card's own padding", async () => {
    const { container } = render(
      <div className="w-full max-w-3xl border border-border bg-card p-2.5 text-sm">
        <MarkdownEditor defaultValue={HOVER_TARGET_TEXT} />
      </div>,
    )
    const handle = await hoverToRevealBlockHandle(container)

    const wrapper = assertDefined(
      container.querySelector('.milkdown-wrapper'),
      'MarkdownEditor always renders its wrapper',
    )
    const parentCard = assertDefined(
      wrapper.parentElement,
      'the test wraps the editor in a card',
    )
    const boundaryRect = parentCard.getBoundingClientRect()
    const handleRect = handle.getBoundingClientRect()
    expect(handleRect.left).toBeGreaterThanOrEqual(boundaryRect.left)
  })

  // Regression check: some call sites (e.g. task-pages-section.tsx,
  // task-activity.tsx) wrap MarkdownEditor in an extra unpadded div before
  // their own padded card, so the handle must walk past that div rather than
  // clamping to its edge.
  it('stays inside a padded ancestor past an extra unpadded wrapper', async () => {
    const { container } = render(
      <div className="w-full max-w-3xl border border-border bg-card p-2.5 text-sm">
        <div className="extra-wrapper text-sm">
          <MarkdownEditor defaultValue={HOVER_TARGET_TEXT} />
        </div>
      </div>,
    )
    const handle = await hoverToRevealBlockHandle(container)

    const wrapper = assertDefined(
      container.querySelector('.milkdown-wrapper'),
      'MarkdownEditor always renders its wrapper',
    )
    const extraWrapper = assertDefined(
      wrapper.parentElement,
      'the test wraps the editor in an extra unpadded div',
    )
    const paddedCard = assertDefined(
      extraWrapper.parentElement,
      'the test wraps the editor in a card',
    )
    const boundaryRect = paddedCard.getBoundingClientRect()
    const handleRect = handle.getBoundingClientRect()
    expect(handleRect.left).toBeGreaterThanOrEqual(boundaryRect.left)
  })

  // Regression check for the leading `+` button hide (see markdown-editor.css)
  // — a separate contract from the handle's own visibility above.
  it('hides the add button, leaving only the drag handle visible', async () => {
    const { container } = render(
      <div className="w-full max-w-3xl border border-border bg-card p-2.5 text-sm">
        <MarkdownEditor defaultValue={HOVER_TARGET_TEXT} />
      </div>,
    )
    const handle = await hoverToRevealBlockHandle(container)

    const visibleOperationItems = [
      ...handle.querySelectorAll('.operation-item'),
    ].filter((el) => getComputedStyle(el).display !== 'none')
    expect(visibleOperationItems).toHaveLength(1)
  })
})
