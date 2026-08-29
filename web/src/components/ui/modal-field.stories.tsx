import type { Meta, StoryObj } from '@storybook/react-vite'
import { CalendarPlus, Layers } from 'lucide-react'
import { useState } from 'react'
import { expect, within } from 'storybook/test'

import { Input } from '#components/ui/input'
import {
  ExpandableFieldChip,
  InlineFieldGroup,
} from '#components/ui/modal-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'
import { selectValueHandler } from '#lib/form-utils'
import { clickSelectOption } from '#lib/test-utils'

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
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Start' }))
    await expect(canvas.getByDisplayValue('2026-08-01')).toBeVisible()
  },
}

type ContextValue = 'work' | 'personal' | 'dev'
const contextValues = [
  '',
  'work',
  'personal',
  'dev',
] as const satisfies readonly (ContextValue | '')[]
const contextLabels: Record<ContextValue, string> = {
  work: 'Work',
  personal: 'Personal',
  dev: 'Dev',
}

function ExpandableContextChipDemo() {
  const [context, setContext] = useState<ContextValue | ''>('')

  return (
    <ExpandableFieldChip
      icon={<Layers className="size-3.5" />}
      label={context ? contextLabels[context] : 'Context'}
      active={context !== ''}
      expanded={(close) => (
        <Select
          value={context}
          onValueChange={(value) => {
            selectValueHandler(setContext, contextValues)(value)
            close()
          }}
        >
          <SelectTrigger
            autoFocus
            size="sm"
            className="h-auto border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
          >
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            <SelectItem value="work">Work</SelectItem>
            <SelectItem value="personal">Personal</SelectItem>
            <SelectItem value="dev">Dev</SelectItem>
          </SelectContent>
        </Select>
      )}
    />
  )
}

export const ExpandableFieldChipExpandedWithSelect: Story = {
  render: () => <ExpandableContextChipDemo />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(canvas.getByRole('button', { name: 'Context' }))
    await userEvent.click(canvas.getByRole('combobox'))
    await clickSelectOption(
      userEvent,
      await body.findByRole('option', { name: 'Work' }),
    )

    // Picking a value closes the chip via the `close()` callback rather than
    // its blur handler, so the collapsed label updates immediately.
    await expect(canvas.getByRole('button', { name: 'Work' })).toBeVisible()
  },
}
