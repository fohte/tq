import type { Meta, StoryObj } from '@storybook/react-vite'

import { BottomTabBar } from '#components/layout/bottom-tab-bar'
import { StoryRouter } from '#storybook-config/story-router'

function BottomTabBarStory() {
  return (
    <div className="flex h-dvh flex-col justify-end">
      <BottomTabBar />
    </div>
  )
}

function BottomTabBarWithRouter({ currentPath }: { currentPath: string }) {
  return <StoryRouter component={BottomTabBarStory} initialPath={currentPath} />
}

const meta = {
  title: 'Layout/BottomTabBar',
  component: BottomTabBarWithRouter,
  tags: ['mobile-only'],
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
  },
  argTypes: {
    currentPath: {
      control: 'select',
      options: ['/', '/tasks', '/projects', '/today', '/settings'],
    },
  },
} satisfies Meta<typeof BottomTabBarWithRouter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    currentPath: '/',
  },
}

export const TasksActive: Story = {
  args: {
    currentPath: '/tasks',
  },
}

export const SettingsActive: Story = {
  args: {
    currentPath: '/settings',
  },
}
