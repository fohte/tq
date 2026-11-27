import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { SidebarProjectFieldsLoadError } from '#components/task/sidebar-project-fields-load-error'

const meta = {
  title: 'Task/TaskDetail/SidebarProjectFieldsLoadError',
  component: SidebarProjectFieldsLoadError,
  args: { onRetry: fn() },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof SidebarProjectFieldsLoadError>

export default meta
type Story = StoryObj<typeof meta>

export const Desktop: Story = {
  name: 'offers a retry when desktop project fields cannot be loaded',
}

export const Mobile: Story = {
  name: 'offers a retry when mobile project fields cannot be loaded',
  args: { mobile: true },
}
