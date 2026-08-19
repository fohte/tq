import type { Meta, StoryObj } from '@storybook/react-vite'

import { BackLink } from '#components/ui/back-header-bar'
import { StoryRouter } from '#storybook-config/story-router'

function BackLinkStory(props: React.ComponentProps<typeof BackLink>) {
  return (
    <StoryRouter
      component={() => (
        <div className="flex h-10 w-96 items-center gap-2.5 border-b border-border px-3">
          <BackLink {...props} />
        </div>
      )}
    />
  )
}

const meta = {
  title: 'UI/BackLink',
  component: BackLinkStory,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof BackLinkStory>

export default meta
type Story = StoryObj<typeof meta>

export const IconOnly: Story = {
  args: {
    to: '/',
    'aria-label': 'Back',
  },
}

export const WithLabel: Story = {
  args: {
    to: '/',
    children: 'Projects',
  },
}
