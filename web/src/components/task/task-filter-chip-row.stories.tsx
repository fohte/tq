import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ParsedQuery } from 'api/search-query-parser'
import { http, HttpResponse } from 'msw'
import { expect, fn, userEvent, within } from 'storybook/test'

import { TaskFilterChipRow } from '#components/task/task-filter-chip-row'
import type { Project } from '#hooks/use-projects'
import { taskKeys } from '#hooks/use-task-queries'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
})
queryClient.setQueryData(taskKeys.detail('parent-abc'), {
  id: 'parent-abc',
  title: 'Version bump the home cluster',
})

const emptySuggestHandler = http.get('/api/tasks/search/suggest', () =>
  HttpResponse.json([]),
)
const emptyLabelsHandler = http.get('/api/labels', () => HttpResponse.json([]))

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
    msw: { handlers: [emptySuggestHandler, emptyLabelsHandler] },
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
    projects,
  },
} satisfies Meta<typeof TaskFilterChipRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NoFilters: Story = {
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

export const LabelSelected: Story = {
  args: {
    parsed: { ...defaultParsed, label: 'dev:tq' },
  },
}

export const HasPagesChip: Story = {
  args: {
    parsed: { ...defaultParsed, hasPages: true },
  },
}

export const FreeTextChips: Story = {
  args: {
    parsed: { ...defaultParsed, freeText: 'foo bar' },
  },
}

export const ParentIdChip: Story = {
  args: {
    parsed: { ...defaultParsed, parentId: 'parent-abc' },
  },
}

// Every applied filter chip opens a menu scoped to just that axis, where
// both changing the value and removing the condition happen — no more
// removing the chip and reopening `+ filter` to pick a different value.
export const OpenStatusMenuAndUncheck: Story = {
  tags: ['desktop-only'],
  play: async ({ canvas, canvasElement, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'is todo, doing' }),
    )

    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('checkbox', { name: 'Todo' }))

    await expect(args.onQueryChange).toHaveBeenCalledWith(
      'is:in_progress sort:updated',
    )
  },
}

export const OpenProjectMenuAndChange: Story = {
  args: {
    parsed: { ...defaultParsed, projectId: 'proj-1' },
  },
  tags: ['desktop-only'],
  play: async ({ canvas, canvasElement, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'project Website Redesign' }),
    )

    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      await body.findByRole('button', { name: 'Mobile App' }),
    )

    await expect(args.onQueryChange).toHaveBeenCalledWith(
      'is:todo is:in_progress project:proj-2 sort:updated',
    )
  },
}

export const OpenLabelMenuAndClear: Story = {
  args: {
    parsed: { ...defaultParsed, label: 'dev:tq' },
  },
  tags: ['desktop-only'],
  play: async ({ canvas, canvasElement, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'label #dev:tq' }))

    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('button', { name: 'No label' }))

    await expect(args.onQueryChange).toHaveBeenCalledWith(
      'is:todo is:in_progress sort:updated',
    )
  },
}

export const OpenPagesMenuAndUncheck: Story = {
  args: {
    parsed: { ...defaultParsed, hasPages: true },
  },
  tags: ['desktop-only'],
  play: async ({ canvas, canvasElement, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'has pages' }))

    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      await body.findByRole('checkbox', { name: 'has pages' }),
    )

    await expect(args.onQueryChange).toHaveBeenCalledWith(
      'is:todo is:in_progress sort:updated',
    )
  },
}

export const OpenParentMenuAndClear: Story = {
  args: {
    parsed: { ...defaultParsed, parentId: 'parent-abc' },
  },
  tags: ['desktop-only'],
  play: async ({ canvas, canvasElement, args }) => {
    await userEvent.click(
      await canvas.findByRole('button', {
        name: 'parent Version bump the home cluster',
      }),
    )

    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      await body.findByRole('button', { name: 'Clear parent filter' }),
    )

    await expect(args.onQueryChange).toHaveBeenCalledWith(
      'is:todo is:in_progress sort:updated',
    )
  },
}

export const RemoveFreeTextWordChip: Story = {
  args: {
    parsed: { ...defaultParsed, freeText: 'foo bar' },
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'foo ×' }))
    await expect(args.onQueryChange).toHaveBeenCalledWith(
      'bar is:todo is:in_progress sort:updated',
    )
  },
}

// Sort is pinned to the row's right edge, outside the wrapping chip area,
// and opens the same kind of menu as any other axis chip.
export const OpenSortMenuAndChange: Story = {
  tags: ['desktop-only'],
  play: async ({ canvas, canvasElement, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Sort by/ }))

    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('button', { name: 'Created' }))

    await expect(args.onQueryChange).toHaveBeenCalledWith(
      'is:todo is:in_progress sort:created',
    )
  },
}

export const DesktopFilterMenuOpen: Story = {
  tags: ['desktop-only'],
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole('button', { name: '+ filter' }))

    // Popup renders via portal, so query the entire document body. Only
    // checks that the STATUS/PROJECT/LABEL sections render — picking an
    // option is covered by task-filter-menu-content.stories.tsx's own
    // SelectProject story.
    const body = within(canvasElement.ownerDocument.body)
    await expect(
      await body.findByRole('checkbox', { name: 'Completed' }),
    ).toBeInTheDocument()
    await expect(
      body.getByRole('button', { name: 'Mobile App' }),
    ).toBeInTheDocument()
    await expect(
      body.getByRole('button', { name: 'No label' }),
    ).toBeInTheDocument()
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
