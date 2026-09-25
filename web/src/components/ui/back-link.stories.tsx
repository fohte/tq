import type { Meta, StoryObj } from '@storybook/react-vite'

import { BackLink } from '#components/ui/back-header-bar'
import { StoryRouter } from '#storybook-config/story-router'

function BackLinkStory(props: React.ComponentProps<typeof BackLink>) {
  return (
    <StoryRouter
      component={() => (
        <div className="flex h-10 w-full max-w-96 items-center gap-2.5 border-b border-border px-3">
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
  name: 'shows a back icon without a text label',
  args: {
    to: '/',
    'aria-label': 'Back',
  },
}

export const WithLabel: Story = {
  name: 'shows a back link labeled Projects',
  args: {
    to: '/',
    children: 'Projects',
  },
}
