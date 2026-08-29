import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { ImageSourceText } from '#components/ui/image-source-text'

const meta = {
  title: 'UI/ImageSourceText',
  component: ImageSourceText,
  parameters: {
    layout: 'centered',
  },
  args: {
    onCommit: fn(),
    onCommitAndMoveOut: fn(),
  },
} satisfies Meta<typeof ImageSourceText>

export default meta
type Story = StoryObj<typeof meta>

export const InlineImage: Story = {
  args: {
    initialText: '![a cat](https://example.com/cat.png)',
    editable: true,
  },
  parameters: {
    // The play only asserts focus, which `.image-source-text { outline:
    // none }` (markdown-editor.css) renders with no visible affordance —
    // identical to CommitsAndMovesOutOnEscape's post-Escape state.
    screenshot: { skip: true },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('![a cat](https://example.com/cat.png)'),
    ).toHaveFocus()
  },
}

export const ImageBlockWithCaption: Story = {
  args: {
    initialText: '![1.00](https://example.com/cat.png "my cat")',
    editable: true,
  },
}

export const Readonly: Story = {
  args: {
    initialText: '![a cat](https://example.com/cat.png)',
    editable: false,
  },
}

export const CommitsOnBlur: Story = {
  args: {
    initialText: '![a cat](https://example.com/cat.png)',
    editable: true,
  },
  play: async ({ canvasElement, args }) => {
    const text = within(canvasElement).getByText(
      '![a cat](https://example.com/cat.png)',
    )
    text.textContent = '![a dog](https://example.com/dog.png)'
    await userEvent.click(canvasElement.ownerDocument.body)
    await expect(args.onCommit).toHaveBeenCalledWith(
      '![a dog](https://example.com/dog.png)',
    )
  },
}

export const CommitsAndMovesOutOnEscape: Story = {
  args: {
    initialText: '![a cat](https://example.com/cat.png)',
    editable: true,
  },
  parameters: {
    // onKeyDown only fires onCommitAndMoveOut; revealing the image and
    // hiding the raw source is the parent's image-source-active class
    // toggle, not this component, so the span is unchanged after Escape —
    // identical to InlineImage.
    screenshot: { skip: true },
  },
  play: async ({ canvasElement, args }) => {
    const text = within(canvasElement).getByText(
      '![a cat](https://example.com/cat.png)',
    )
    await userEvent.keyboard('{Escape}')
    await expect(args.onCommitAndMoveOut).toHaveBeenCalledWith(text.textContent)
  },
}
