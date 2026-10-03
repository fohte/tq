import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { makeDescriptionTemplate } from '#components/settings/description-template-test-fixtures'
import { CreateTaskModalDescriptionTemplateSelector } from '#components/task/create-task-modal-description-template-selector'

const meta = {
  title: 'Task/CreateTaskModalDescriptionTemplateSelector',
  component: CreateTaskModalDescriptionTemplateSelector,
  parameters: { layout: 'centered' },
  args: {
    templates: [
      makeDescriptionTemplate({ name: 'General task' }),
      makeDescriptionTemplate({
        id: 'description-template-2',
        name: 'Quick note',
        body: '## Summary',
        isDefault: false,
      }),
    ],
    selectedTemplateName: 'General task',
    onChange: fn(),
  },
} satisfies Meta<typeof CreateTaskModalDescriptionTemplateSelector>

export default meta
type Story = StoryObj<typeof meta>

export const SelectedTemplate: Story = {
  name: 'shows the selected template and the available alternatives',
}

export const NoTemplates: Story = {
  name: 'shows that no template is selected when none are available',
  args: {
    templates: [],
    selectedTemplateName: null,
  },
}
