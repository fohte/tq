import { Button } from '@fohte/ui/button'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'

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
  component: DropdownMenuItemsDemo,
  parameters: {
    layout: 'centered',
  },
  args: {
    onOpenChange: fn(),
  },
} satisfies Meta<typeof DropdownMenuItemsDemo>

export default meta

export const ItemsClosedTrigger: StoryObj<typeof DropdownMenuItemsDemo> = {
  name: 'shows an actions menu trigger before opening it',
  render: (args) => <DropdownMenuItemsDemo {...args} />,
  args: {
    open: false,
    onOpenChange: fn(),
  },
}

export const ItemsOpen: StoryObj<typeof DropdownMenuItemsDemo> = {
  name: 'shows edit, duplicate, and delete actions',
  render: (args) => <DropdownMenuItemsDemo {...args} />,
  args: {
    open: true,
    onOpenChange: fn(),
  },
}

export const CheckboxOpen: StoryObj<typeof DropdownMenuCheckboxDemo> = {
  name: 'shows a checked option to include archived items',
  render: (args) => <DropdownMenuCheckboxDemo {...args} />,
  args: {
    open: true,
    onOpenChange: fn(),
  },
}
