import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ProjectFieldsManagerDialog } from '#components/project/project-fields-manager-dialog'
import { makeProjectField } from '#components/project/project-test-fixtures'

const fields = [makeProjectField()]

const meta = {
  title: 'Project/ProjectDetail/FieldsManagerDialog',
  component: ProjectFieldsManagerDialog,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    open: true,
    onOpenChange: fn(),
    fields,
    onCreateField: fn(() => Promise.resolve()),
    onRenameField: fn(() => Promise.resolve()),
    onDeleteField: fn(() => Promise.resolve()),
    onCreateOption: fn(() => Promise.resolve()),
    onRenameOption: fn(() => Promise.resolve()),
    onDeleteOption: fn(() => Promise.resolve()),
  },
} satisfies Meta<typeof ProjectFieldsManagerDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  name: 'the project has no custom fields yet',
  args: {
    fields: [],
  },
}

export const Loading: Story = {
  name: 'the fields list is loading',
  args: {
    isLoading: true,
  },
}

export const LoadError: Story = {
  name: 'the fields list shows a loading error',
  args: {
    loadError: true,
  },
}

export const WithFields: Story = {
  name: 'the project has a field with two options',
}

export const EditingField: Story = {
  name: 'a field name is being edited',
  args: {
    initialEditingFieldId: 'field-a',
  },
}

export const EditingOption: Story = {
  name: 'an option name is being edited',
  args: {
    initialEditingOption: { fieldId: 'field-a', optionId: 'option-a' },
  },
}

export const DuplicateNameError: Story = {
  name: 'a duplicate field name is shown as an error',
  args: {
    initialErrorMessage: 'このプロジェクトには同じ名前のフィールドがあります',
  },
}

export const DuplicateOptionNameError: Story = {
  name: 'a duplicate option name is shown as an error',
  args: {
    initialErrorMessage: 'このフィールドには同じ名前の選択肢があります',
  },
}

export const ConfirmingFieldDeletion: Story = {
  name: 'field deletion explains that task values will be removed',
  args: {
    initialDeleteTarget: {
      kind: 'field',
      fieldId: 'field-a',
      name: 'SampleCategory',
    },
  },
}

export const ConfirmingOptionDeletion: Story = {
  name: 'option deletion explains that affected tasks will become unset',
  args: {
    initialDeleteTarget: {
      kind: 'option',
      fieldId: 'field-a',
      optionId: 'option-a',
      name: 'OptionA',
    },
  },
}
