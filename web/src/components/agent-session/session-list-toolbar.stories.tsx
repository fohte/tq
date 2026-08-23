import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn } from 'storybook/test'

import {
  type SessionFilterTab,
  SessionListToolbar,
} from '#components/agent-session/session-list-toolbar'

function SessionListToolbarStateful({
  initialFilter = 'all',
  onFilterChange,
}: {
  initialFilter?: SessionFilterTab
  onFilterChange: (filter: SessionFilterTab) => void
}) {
  const [filter, setFilter] = useState<SessionFilterTab>(initialFilter)

  return (
    <div className="w-2xl">
      <SessionListToolbar
        filter={filter}
        onFilterChange={(next) => {
          setFilter(next)
          onFilterChange(next)
        }}
      />
    </div>
  )
}

const meta = {
  title: 'AgentSession/SessionListToolbar',
  component: SessionListToolbarStateful,
  parameters: {
    layout: 'centered',
  },
  args: {
    onFilterChange: fn(),
  },
} satisfies Meta<typeof SessionListToolbarStateful>

export default meta
type Story = StoryObj<typeof meta>

export const All: Story = {}

export const Active: Story = {
  args: {
    initialFilter: 'active',
  },
}

export const InteractionTest: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const allTab = canvas.getByText('all')
    const activeTab = canvas.getByText('active')

    await expect(allTab).toHaveAttribute('aria-pressed', 'true')
    await expect(activeTab).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(activeTab)
    await expect(args.onFilterChange).toHaveBeenCalledWith('active')
    await expect(activeTab).toHaveAttribute('aria-pressed', 'true')
  },
}
