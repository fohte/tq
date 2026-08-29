import type { Meta, StoryObj } from '@storybook/react-vite'

import { BackHeaderBar } from '#components/ui/back-header-bar'
import { StoryRouter } from '#storybook-config/story-router'

function BackHeaderBarStory(props: React.ComponentProps<typeof BackHeaderBar>) {
  return (
    <StoryRouter
      component={() => (
        <div className="w-full max-w-96 border border-border">
          <BackHeaderBar {...props} />
        </div>
      )}
    />
  )
}

const meta = {
  title: 'UI/BackHeaderBar',
  component: BackHeaderBarStory,
  tags: ['mobile-only'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof BackHeaderBarStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    to: '/',
    children: 'Projects',
  },
}
