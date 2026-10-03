import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { fn } from 'storybook/test'

import { DescriptionTemplateRowView } from '#components/settings/description-template-row'
import { makeDescriptionTemplate } from '#components/settings/description-template-test-fixtures'

function WrappedDescriptionTemplateRowView(
  props: ComponentProps<typeof DescriptionTemplateRowView>,
) {
  return (
    <div className="w-full max-w-3xl">
      <DescriptionTemplateRowView {...props} />
    </div>
  )
}

const meta = {
  title: 'Settings/DescriptionTemplateRowView',
  component: WrappedDescriptionTemplateRowView,
  parameters: {
    layout: 'centered',
  },
  args: {
    onEdit: fn(),
    onDelete: fn(),
    isDeletePending: false,
  },
} satisfies Meta<typeof WrappedDescriptionTemplateRowView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'a default template shows its name and markdown headings',
  args: {
    template: makeDescriptionTemplate({
      id: 'template-id-1',
      name: 'Sample template',
      body: '## Goal\n\n## Outcome',
      isDefault: true,
    }),
  },
}

export const NonDefault: Story = {
  name: 'a non-default template has no default marker',
  args: {
    template: makeDescriptionTemplate({
      id: 'template-id-2',
      name: 'Review template',
      body: '## Scope\n\n## Findings',
      isDefault: false,
    }),
  },
}

export const DeleteFailed: Story = {
  name: 'a template shows an error after deletion fails',
  args: {
    template: makeDescriptionTemplate({
      id: 'template-id-3',
      name: 'Failed template',
    }),
    deleteError: 'テンプレートの削除に失敗しました',
  },
}
