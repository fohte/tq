import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn } from 'storybook/test'

import {
  type ProjectFilterTab,
  ProjectListToolbar,
} from '#components/project/project-list-toolbar'

function ProjectListToolbarStateful({
  initialFilter = 'active',
  onFilterChange,
  onCreate,
}: {
  initialFilter?: ProjectFilterTab
  onFilterChange: (filter: ProjectFilterTab) => void
  onCreate: () => void
}) {
  const [filter, setFilter] = useState<ProjectFilterTab>(initialFilter)

  return (
    <div className="w-full max-w-2xl">
      <ProjectListToolbar
        filter={filter}
        onFilterChange={(next) => {
          setFilter(next)
          onFilterChange(next)
        }}
        onCreate={onCreate}
      />
    </div>
  )
}

const meta = {
  title: 'Project/ProjectListToolbar',
  component: ProjectListToolbarStateful,
  parameters: {
    layout: 'centered',
  },
  args: {
    onFilterChange: fn(),
    onCreate: fn(),
  },
} satisfies Meta<typeof ProjectListToolbarStateful>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {}

export const All: Story = {
  args: {
    initialFilter: 'all',
  },
}

export const InteractionTest: Story = {
  parameters: {
    // Clicking the "all" tab drives real internal state, so the final
    // render matches the All story — this only proves the callback and
    // aria-pressed update, not a distinct look.
    screenshot: { skip: true },
  },
  play: async ({ canvas, args, userEvent }) => {
    const activeTab = canvas.getByText('active')
    const allTab = canvas.getByText('all')

    await expect(activeTab).toHaveAttribute('aria-pressed', 'true')
    await expect(allTab).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(allTab)
    await expect(args.onFilterChange).toHaveBeenCalledWith('all')
    await expect(allTab).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(canvas.getByText('+ new'))
    await expect(args.onCreate).toHaveBeenCalledOnce()
  },
}
