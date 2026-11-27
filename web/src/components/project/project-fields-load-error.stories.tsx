import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ProjectFieldsLoadError } from '#components/project/project-fields-load-error'

const meta = {
  title: 'Project/ProjectFieldsLoadError',
  component: ProjectFieldsLoadError,
  args: { onRetry: fn() },
} satisfies Meta<typeof ProjectFieldsLoadError>

export default meta
type Story = StoryObj<typeof meta>

export const Error: Story = {
  name: 'the project field controls show a load error with retry',
}
