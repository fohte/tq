import type { Meta, StoryObj } from '@storybook/react-vite'
import { CalendarPlus, Layers } from 'lucide-react'

import { Input } from '#components/ui/input'
import {
  ExpandableFieldChip,
  InlineFieldGroup,
} from '#components/ui/modal-field'
import { ExpandableContextChipDemo } from '#components/ui/modal-field-test-fixtures'

const meta = {
  title: 'UI/ModalField',
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const InlineFieldGroupDefault: Story = {
  name: 'InlineFieldGroup',
  render: () => (
    <InlineFieldGroup
      label="Start"
      icon={<CalendarPlus className="size-3.5" />}
    >
      <span className="text-foreground">2026-08-01</span>
    </InlineFieldGroup>
  ),
}

export const InlineFieldGroupRow: Story = {
  render: () => (
    <div className="flex flex-wrap items-end gap-4">
      <InlineFieldGroup
        label="Start"
        icon={<CalendarPlus className="size-3.5" />}
      >
        <span className="text-foreground">2026-08-01</span>
      </InlineFieldGroup>
      <InlineFieldGroup label="Context" icon={<Layers className="size-3.5" />}>
        <span className="text-muted-foreground">—</span>
      </InlineFieldGroup>
    </div>
  ),
}

export const ExpandableFieldChipInactive: Story = {
  render: () => (
    <ExpandableFieldChip
      icon={<CalendarPlus className="size-3.5" />}
      label="Start"
      active={false}
    />
  ),
}

export const ExpandableFieldChipActive: Story = {
  render: () => (
    <ExpandableFieldChip
      icon={<CalendarPlus className="size-3.5" />}
      label="2026-08-01"
      active
    />
  ),
}

export const ExpandableFieldChipExpanded: Story = {
  render: () => (
    <ExpandableFieldChip
      icon={<CalendarPlus className="size-3.5" />}
      label="Start"
      defaultOpen
      expanded={() => (
        <Input
          type="date"
          defaultValue="2026-08-01"
          autoFocus
          className="h-auto w-28 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:border-0 focus-visible:ring-0"
        />
      )}
    />
  ),
}

export const ExpandableFieldChipExpandedWithSelect: Story = {
  render: () => <ExpandableContextChipDemo defaultOpen />,
}
