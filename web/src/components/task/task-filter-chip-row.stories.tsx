import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { TaskFilterChipRow } from '#components/task/task-filter-chip-row'
import type { Project } from '#hooks/use-projects'
import { assertDefined } from '#lib/test-utils'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const emptySuggestHandler = http.get('/api/tasks/search/suggest', () =>
  HttpResponse.json([]),
)

const projectA: Project = {
  id: 'proj-1',
  title: 'Website Redesign',
  description: null,
  status: 'active',
  startDate: null,
  targetDate: null,
  color: null,
  sortOrder: 0,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  taskCount: { total: 0, completed: 0 },
  completionRate: 0,
}

const projectB: Project = {
  ...projectA,
  id: 'proj-2',
  title: 'Mobile App',
}

const projects = [projectA, projectB]

const meta = {
  title: 'Task/TaskFilterChipRow',
  component: TaskFilterChipRow,
  parameters: {
    // The chip row is intentionally horizontally scrollable
    // (overflow-x-auto) so it never breaks the tasks page header at mobile
    // widths — see create-task-modal.stories.tsx for the same exemption.
    overflowCheck: { ignoreSelectors: ['.overflow-x-auto'] },
    msw: { handlers: [emptySuggestHandler] },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: {
    query: 'is:todo is:in_progress sort:updated',
    onQueryChange: fn(),
    showCompleted: false,
    onShowCompletedChange: fn(),
    sortBy: 'updated',
    onSortByChange: fn(),
    projects,
    projectId: undefined,
    onProjectIdChange: fn(),
    tag: undefined,
    onTagChange: fn(),
    extra: undefined,
    onExtraChange: fn(),
  },
} satisfies Meta<typeof TaskFilterChipRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ShowCompleted: Story = {
  args: {
    showCompleted: true,
  },
}

export const SortByCreated: Story = {
  args: {
    sortBy: 'created',
  },
}

export const ProjectSelected: Story = {
  args: {
    projectId: 'proj-1',
  },
}

export const NoProjects: Story = {
  args: {
    projects: [],
  },
}

export const TagSelected: Story = {
  args: {
    tag: 'dev:tq',
  },
}

export const RemoveNotCompletedChip: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'not completed ×' }),
    )
    await expect(args.onShowCompletedChange).toHaveBeenCalledWith(true)
  },
}

export const RemoveProjectChip: Story = {
  args: {
    projectId: 'proj-1',
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'project: Website Redesign ×' }),
    )
    await expect(args.onProjectIdChange).toHaveBeenCalledWith('')
  },
}

export const RemoveTagChip: Story = {
  args: {
    tag: 'dev:tq',
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: '#dev:tq ×' }))
    await expect(args.onTagChange).toHaveBeenCalledWith(undefined)
  },
}

// A token typed into the inline query input that none of the structured
// pickers (is:/sort:/project:/label:) understand — e.g. `has:pages` — still
// shows up as its own chip instead of silently vanishing on the next edit.
export const ExtraTokenChip: Story = {
  args: {
    extra: 'has:pages',
  },
}

export const RemoveExtraTokenChip: Story = {
  args: {
    extra: 'has:pages parent:abc',
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'has:pages ×' }))
    await expect(args.onExtraChange).toHaveBeenCalledWith('parent:abc')
  },
}

// Both `+ filter` triggers exist in the DOM at once (only one is visible per
// the `hidden md:inline-flex` / `inline-flex md:hidden` split, resolved by
// the real browser viewport `web/vitest.config.ts` sets per project) —
// select each by its `data-slot` rather than an ambiguous accessible-name
// query.
export const DesktopFilterMenuOpen: Story = {
  play: async ({ canvasElement, args }) => {
    // Menu renders via portal, so query the entire document body
    const body = within(canvasElement.ownerDocument.body)

    const trigger = assertDefined(
      canvasElement.querySelector<HTMLElement>(
        '[data-slot="dropdown-menu-trigger"]',
      ),
      'desktop trigger not found',
    )
    await userEvent.click(trigger)

    await expect(
      await body.findByRole('menuitemcheckbox', { name: 'show completed' }),
    ).toBeInTheDocument()
    await expect(
      body.getByRole('menuitemradio', { name: 'Sort: Created' }),
    ).toBeInTheDocument()
    await expect(
      body.getByRole('menuitemradio', { name: 'Mobile App' }),
    ).toBeInTheDocument()

    await userEvent.click(
      body.getByRole('menuitemradio', { name: 'Mobile App' }),
    )
    // Base UI's RadioGroup passes a second `eventDetails` argument alongside the value
    await expect(args.onProjectIdChange).toHaveBeenCalledWith(
      'proj-2',
      expect.anything(),
    )
  },
}

export const MobileFilterSheetOpen: Story = {
  play: async ({ canvasElement }) => {
    // Sheet renders via portal, so query the entire document body
    const body = within(canvasElement.ownerDocument.body)

    const trigger = assertDefined(
      canvasElement.querySelector<HTMLElement>('[data-slot="dialog-trigger"]'),
      'mobile trigger not found',
    )
    await userEvent.click(trigger)

    await expect(
      await body.findByRole('checkbox', { name: 'show completed' }),
    ).toBeInTheDocument()
    await expect(
      body.getByRole('button', { name: 'Created' }),
    ).toBeInTheDocument()
    await expect(
      body.getByRole('button', { name: 'Mobile App' }),
    ).toBeInTheDocument()
    await expect(body.getByRole('button', { name: 'work' })).toBeInTheDocument()
  },
}

export const SelectProjectInMobileFilterSheet: Story = {
  play: async ({ canvasElement, args }) => {
    // Sheet renders via portal, so query the entire document body
    const body = within(canvasElement.ownerDocument.body)

    const trigger = assertDefined(
      canvasElement.querySelector<HTMLElement>('[data-slot="dialog-trigger"]'),
      'mobile trigger not found',
    )
    await userEvent.click(trigger)

    // Base UI moves focus to the dialog's first tabbable element (the close
    // button) asynchronously via requestAnimationFrame. Wait for it to land
    // before clicking "Mobile App", otherwise it can race the click and
    // steal focus back afterward, making the VRT screenshot's focus ring
    // non-deterministic.
    await waitFor(() =>
      expect(body.getByRole('button', { name: 'Close' })).toHaveFocus(),
    )

    await userEvent.click(
      await body.findByRole('button', { name: 'Mobile App' }),
    )
    await expect(args.onProjectIdChange).toHaveBeenCalledWith('proj-2')
  },
}

// PC only: clicking the `>` trigger swaps the chip list for the raw query
// input, pre-filled with the current query.
export const EnterEditModeOnDesktop: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Edit filter query' }),
    )

    await expect(
      canvas.getByRole('textbox', { name: 'Edit filter query' }),
    ).toHaveValue('is:todo is:in_progress sort:updated')
  },
}

export const CommitEditOnBlur: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Edit filter query' }),
    )

    const input = canvas.getByRole('textbox', { name: 'Edit filter query' })
    await userEvent.clear(input)
    await userEvent.type(input, 'sort:created has:pages')
    await userEvent.tab()

    await expect(args.onQueryChange).toHaveBeenCalledWith(
      'sort:created has:pages',
    )
    // Back to the chip display once the edit commits.
    await expect(
      canvas.queryByRole('textbox', { name: 'Edit filter query' }),
    ).not.toBeInTheDocument()
  },
}

export const CancelEditOnEscape: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Edit filter query' }),
    )

    const input = canvas.getByRole('textbox', { name: 'Edit filter query' })
    await userEvent.type(input, ' has:pages')
    await userEvent.keyboard('{Escape}')

    await expect(args.onQueryChange).not.toHaveBeenCalled()
    await expect(
      canvas.queryByRole('textbox', { name: 'Edit filter query' }),
    ).not.toBeInTheDocument()
  },
}
