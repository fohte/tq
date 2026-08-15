import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'

import { Button } from '#components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'

function DropdownMenuDemo({
  open,
  onOpenChange,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [value, setValue] = useState('date')

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger render={<Button />}>Sort by</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup value={value} onValueChange={setValue}>
          <DropdownMenuRadioItem value="date">Date</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="type">Type</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DropdownMenuCheckboxDemo({
  open,
  onOpenChange,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [checked, setChecked] = useState(true)

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger render={<Button />}>Options</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuCheckboxItem
          checked={checked}
          onCheckedChange={setChecked}
        >
          Show archived
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DropdownMenuItemsDemo({
  open,
  onOpenChange,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger render={<Button />}>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuItem>Duplicate</DropdownMenuItem>
        <DropdownMenuItem>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const meta = {
  title: 'UI/DropdownMenu',
  component: DropdownMenuDemo,
  parameters: {
    layout: 'centered',
  },
  args: {
    onOpenChange: fn(),
  },
} satisfies Meta<typeof DropdownMenuDemo>

export default meta
type Story = StoryObj<typeof meta>

export const ClosedTrigger: Story = {
  args: {
    open: false,
  },
}

export const Open: Story = {
  args: {
    open: true,
  },
}

export const ItemsClosedTrigger: StoryObj<typeof DropdownMenuItemsDemo> = {
  render: (args) => <DropdownMenuItemsDemo {...args} />,
  args: {
    open: false,
    onOpenChange: fn(),
  },
}

export const ItemsOpen: StoryObj<typeof DropdownMenuItemsDemo> = {
  render: (args) => <DropdownMenuItemsDemo {...args} />,
  args: {
    open: true,
    onOpenChange: fn(),
  },
}

export const CheckboxOpen: StoryObj<typeof DropdownMenuCheckboxDemo> = {
  render: (args) => <DropdownMenuCheckboxDemo {...args} />,
  args: {
    open: true,
    onOpenChange: fn(),
  },
}
