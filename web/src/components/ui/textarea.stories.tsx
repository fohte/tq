import type { Meta, StoryObj } from '@storybook/react-vite'

import { Textarea } from '#components/ui/textarea'

const meta = {
  title: 'UI/Textarea',
  component: Textarea,
  tags: ['autodocs'],
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'shows an empty multiline text area',
  args: {},
}

export const WithValue: Story = {
  name: 'shows a multiline task checklist',
  args: {
    defaultValue: '- [ ] Review PR\n- [ ] Update docs\n- [ ] Deploy to staging',
  },
}

export const Disabled: Story = {
  name: 'shows a disabled description text area',
  args: {
    placeholder: 'Add description...',
    disabled: true,
  },
}

export const Placeholder: Story = {
  name: 'shows the placeholder in an empty description text area',
  args: {
    placeholder: 'Add description...',
  },
}

export const Code: Story = {
  name: 'the text area shows compact code notes',
  args: {
    variant: 'code',
    defaultValue: 'Notes for this focus session',
    rows: 5,
  },
}

export const Monospace: Story = {
  name: 'the text area shows HTML source in a monospace style',
  args: {
    variant: 'monospace',
    defaultValue: '<main>Page source</main>',
    rows: 5,
  },
}
