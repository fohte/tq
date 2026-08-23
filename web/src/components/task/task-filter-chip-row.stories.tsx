import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ParsedQuery } from 'api/search-query-parser'
import { buildSearchQuery } from 'api/search-query-parser'
import { http, HttpResponse } from 'msw'
import { expect, fn, userEvent, within } from 'storybook/test'

import { TaskFilterChipRow } from '#components/task/task-filter-chip-row'
import type { Project } from '#hooks/use-projects'

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

const defaultParsed: ParsedQuery = {
  freeText: '',
  status: ['todo', 'in_progress'],
  sortBy: 'updated',
}

const meta = {
  title: 'Task/TaskFilterChipRow',
  component: TaskFilterChipRow,
  parameters: {
    // The chip row is intentionally horizontally scrollable
    // (overflow-x-auto) so it never breaks the tasks page header at mobile
    // widths — see create-task-modal.stories.tsx for the same exemption.
    overflowCheck: {
      ignoreSelectors: ['.overflow-x-auto'],
    },
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
    parsed: defaultParsed,
    onShowCompletedChange: fn(),
    onSortByChange: fn(),
    projects,
    onProjectIdChange: fn(),
    onTagChange: fn(),
  },
} satisfies Meta<typeof TaskFilterChipRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ShowCompleted: Story = {
  args: {
    parsed: { freeText: '', sortBy: 'updated' },
  },
}

export const SortByCreated: Story = {
  args: {
    parsed: { ...defaultParsed, sortBy: 'created' },
  },
}

export const ProjectSelected: Story = {
  args: {
    parsed: { ...defaultParsed, projectId: 'proj-1' },
  },
}

export const NoProjects: Story = {
  args: {
    projects: [],
  },
}

export const TagSelected: Story = {
  args: {
    parsed: { ...defaultParsed, label: 'dev:tq' },
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
    parsed: { ...defaultParsed, projectId: 'proj-1' },
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
    parsed: { ...defaultParsed, label: 'dev:tq' },
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: '#dev:tq ×' }))
    await expect(args.onTagChange).toHaveBeenCalledWith(undefined)
  },
}

// A structured field that is understood by search-query-parser but has no
// dedicated picker in this row (has:pages) still shows up as its own
// removable chip.
export const HasPagesChip: Story = {
  args: {
    parsed: { ...defaultParsed, hasPages: true },
  },
}

export const RemoveHasPagesChip: Story = {
  args: {
    parsed: { ...defaultParsed, hasPages: true },
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'has:pages ×' }))
    await expect(args.onQueryChange).toHaveBeenCalledWith(
      buildSearchQuery(defaultParsed),
    )
  },
}

export const FreeTextChips: Story = {
  args: {
    parsed: { ...defaultParsed, freeText: 'foo bar' },
  },
}

export const RemoveFreeTextWordChip: Story = {
  args: {
    parsed: { ...defaultParsed, freeText: 'foo bar' },
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'foo ×' }))
    await expect(args.onQueryChange).toHaveBeenCalledWith(
      buildSearchQuery({ ...defaultParsed, freeText: 'bar' }),
    )
  },
}

export const ParentIdChip: Story = {
  args: {
    parsed: { ...defaultParsed, parentId: 'parent-abc' },
  },
}

export const RemoveParentIdChip: Story = {
  args: {
    parsed: { ...defaultParsed, parentId: 'parent-abc' },
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'parent:parent-abc ×' }),
    )
    await expect(args.onQueryChange).toHaveBeenCalledWith(
      buildSearchQuery(defaultParsed),
    )
  },
}

// FilterMenu picks the container (popover vs. bottom sheet) via
// useIsDesktop(), so only one `+ filter` trigger exists in the DOM per
// project's viewport — the accessible name alone is enough to find it.
export const DesktopFilterMenuOpen: Story = {
  tags: ['desktop-only'],
  play: async ({ canvas, canvasElement, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: '+ filter' }))

    // Popup renders via portal, so query the entire document body
    const body = within(canvasElement.ownerDocument.body)
    await expect(
      await body.findByRole('checkbox', { name: 'show completed' }),
    ).toBeInTheDocument()
    await expect(
      body.getByRole('button', { name: 'Created' }),
    ).toBeInTheDocument()
    await expect(
      body.getByRole('button', { name: 'Mobile App' }),
    ).toBeInTheDocument()

    await userEvent.click(body.getByRole('button', { name: 'Mobile App' }))
    await expect(args.onProjectIdChange).toHaveBeenCalledWith('proj-2')
  },
}

// PC only: clicking the `>` trigger swaps the chip list for the raw query
// input, pre-filled with the current query. The trigger itself is `hidden
// md:inline-flex` with no mobile equivalent, so edit mode is unreachable
// below the `md` breakpoint — CSF's static tags parser requires a literal
// here, not the imported DESKTOP_ONLY_TAG constant.
export const EnterEditModeOnDesktop: Story = {
  tags: ['desktop-only'],
  play: async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Edit filter query' }),
    )

    await expect(
      canvas.getByRole('textbox', { name: 'Edit filter query' }),
    ).toHaveValue('is:todo is:in_progress sort:updated')
  },
}

// Also desktop-only: reaches edit mode via the same PC-only trigger as
// EnterEditModeOnDesktop above.
export const CommitEditOnBlur: Story = {
  tags: ['desktop-only'],
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

// Also desktop-only: reaches edit mode via the same PC-only trigger as
// EnterEditModeOnDesktop above.
export const CancelEditOnEscape: Story = {
  tags: ['desktop-only'],
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
