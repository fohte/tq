import type { Meta, StoryObj } from '@storybook/react-vite'

import { UrlCopiedToast } from '#components/layout/url-copied-toast'

const meta = {
  title: 'Layout/UrlCopiedToast',
  component: UrlCopiedToast,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof UrlCopiedToast>

export default meta
type Story = StoryObj<typeof meta>

export const Copied: Story = {
  name: 'a copied task URL appears in a confirmation toast',
  args: {
    url: 'https://example.test/tasks/42',
  },
}

export const LongUrl: Story = {
  name: 'a long copied URL wraps within the confirmation toast',
  args: {
    url: 'https://example.test/projects/42/tasks/43/pages/44?view=details&panel=activity',
  },
}
