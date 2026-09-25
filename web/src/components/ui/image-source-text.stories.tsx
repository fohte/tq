import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

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
  name: 'shows an editable Markdown image source',
  args: {
    initialText: '![a cat](https://example.com/cat.png)',
    editable: true,
  },
}

export const ImageBlockWithCaption: Story = {
  name: 'shows an editable Markdown image source with alt text and a title',
  args: {
    initialText: '![1.00](https://example.com/cat.png "my cat")',
    editable: true,
  },
}

export const Readonly: Story = {
  name: 'shows a read-only Markdown image source',
  args: {
    initialText: '![a cat](https://example.com/cat.png)',
    editable: false,
  },
}
