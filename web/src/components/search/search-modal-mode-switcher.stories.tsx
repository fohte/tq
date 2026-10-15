import type { Meta, StoryObj } from '@storybook/react-vite'

import { SearchModalModeSwitcher } from '#components/search/search-modal-mode-switcher'

const meta = {
  title: 'Search/SearchModalModeSwitcher',
  component: SearchModalModeSwitcher,
  tags: ['mobile-only'],
  args: {
    modePrefix: '#',
    onModeChange: () => undefined,
  },
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div
        className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-border px-3 py-1.5 md:hidden"
        role="group"
        aria-label="Search mode"
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SearchModalModeSwitcher>

export default meta
type Story = StoryObj<typeof meta>

export const TasksSelected: Story = {
  name: 'the task search mode is selected among the mobile search filters',
}
