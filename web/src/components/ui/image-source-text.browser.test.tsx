import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ImageSourceText } from '#components/ui/image-source-text'

const CAT_TEXT = '![a cat](https://example.com/cat.png)'

describe('ImageSourceText', () => {
  it('focuses the text on mount when editable', () => {
    render(
      <ImageSourceText
        initialText={CAT_TEXT}
        editable
        onCommit={vi.fn()}
        onCommitAndMoveOut={vi.fn()}
      />,
    )

    expect(screen.getByText(CAT_TEXT)).toHaveFocus()
  })

  it('commits the edited text on blur', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(
      <ImageSourceText
        initialText={CAT_TEXT}
        editable
        onCommit={onCommit}
        onCommitAndMoveOut={vi.fn()}
      />,
    )

    const text = screen.getByText(CAT_TEXT)
    text.textContent = '![a dog](https://example.com/dog.png)'
    await user.click(document.body)

    expect(onCommit).toHaveBeenCalledWith(
      '![a dog](https://example.com/dog.png)',
    )
  })

  it('commits and moves out on Escape', async () => {
    const user = userEvent.setup()
    const onCommitAndMoveOut = vi.fn()
    render(
      <ImageSourceText
        initialText={CAT_TEXT}
        editable
        onCommit={vi.fn()}
        onCommitAndMoveOut={onCommitAndMoveOut}
      />,
    )
    const text = screen.getByText(CAT_TEXT)

    await user.keyboard('{Escape}')

    expect(onCommitAndMoveOut).toHaveBeenCalledWith(text.textContent)
  })
})
