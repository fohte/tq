import type { Meta, StoryObj } from '@storybook/react-vite'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '#components/ui/tabs'

function TabsDemo({
  defaultValue = 'today',
  disabledValue,
}: {
  defaultValue?: string
  disabledValue?: string
}) {
  return (
    <Tabs defaultValue={defaultValue} className="w-80">
      <TabsList>
        <TabsTrigger value="today" disabled={disabledValue === 'today'}>
          today
        </TabsTrigger>
        <TabsTrigger value="all" disabled={disabledValue === 'all'}>
          all
        </TabsTrigger>
        <TabsTrigger value="backlog" disabled={disabledValue === 'backlog'}>
          backlog
        </TabsTrigger>
      </TabsList>
      <TabsContent value="today">Tasks due today.</TabsContent>
      <TabsContent value="all">Every task across all projects.</TabsContent>
      <TabsContent value="backlog">Tasks with no due date.</TabsContent>
    </Tabs>
  )
}

const meta = {
  title: 'UI/Tabs',
  component: TabsDemo,
  tags: ['autodocs'],
} satisfies Meta<typeof TabsDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'shows tasks due today with the Today tab selected',
  args: {
    defaultValue: 'today',
  },
}

export const SecondTabActive: Story = {
  name: 'shows all tasks with the All tab selected',
  args: {
    defaultValue: 'all',
  },
}

export const Disabled: Story = {
  name: 'shows a disabled backlog tab beside tasks due today',
  args: {
    defaultValue: 'today',
    disabledValue: 'backlog',
  },
}
