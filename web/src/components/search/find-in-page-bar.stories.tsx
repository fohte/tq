import type { Meta, StoryObj } from '@storybook/react-vite'

import { FindInPageBar } from '#components/search/find-in-page-bar'

const meta = {
  title: 'Search/FindInPageBar',
  component: FindInPageBar,
  args: {
    open: true,
    onClose: () => undefined,
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof FindInPageBar>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
  name: 'the find bar is open over the page',
}
