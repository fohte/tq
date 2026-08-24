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

export const FreeTextInInput: Story = {
  args: {
    parsed: { ...defaultParsed, freeText: 'foo bar' },
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('textbox', { name: 'Filter query' }),
    ).toHaveValue('foo bar')
  },
}

export const ParentIdChip: Story = {
  args: {
    parsed: { ...defaultParsed, parentId: 'parent-abc' },
  },
}

// Every applied filter chip opens a menu scoped to just that axis, where
// both changing the value and removing the condition happen — no need to
// leave the chip and re-add the condition elsewhere.
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

export const EditFreeTextDirectly: Story = {
  args: {
    parsed: { ...defaultParsed, freeText: 'foo bar' },
  },
  play: async ({ canvas, args }) => {
    const input = canvas.getByRole('textbox', { name: 'Filter query' })
    // Overwrite the whole value instead of appending, so the result doesn't
    // depend on where the browser places the caret after a click.
    await userEvent.clear(input)
    await userEvent.type(input, 'foo')
    await userEvent.tab()

    await expect(args.onQueryChange).toHaveBeenCalledWith(
      'foo is:todo is:in_progress sort:updated',
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

// Typing a recognized `key:value` token into the trailing free-text box and
// confirming lifts it out into its own chip instead of staying as literal
// text — the token-input behavior this row is built around.
export const TypingStructuredTokenLiftsIntoChip: Story = {
  args: {
    parsed: { freeText: '', sortBy: 'updated' },
  },
  play: async ({ canvas, args }) => {
    const input = canvas.getByRole('textbox', { name: 'Filter query' })
    await userEvent.type(input, 'has:pages')
    await userEvent.keyboard('{Enter}')

    await expect(args.onQueryChange).toHaveBeenCalledWith(
      'has:pages sort:updated',
    )
  },
}

// Committing a `key:value` token that's already applied (e.g. `is:todo` when
// the status chip already shows it) must not duplicate it — the merge
// dedupes against the currently-applied status array instead of blindly
// concatenating and re-parsing the whole query string.
export const TypingAlreadyAppliedStatusTokenDoesNotDuplicate: Story = {
  play: async ({ canvas, args }) => {
    const input = canvas.getByRole('textbox', { name: 'Filter query' })
    await userEvent.type(input, 'is:todo')
    await userEvent.keyboard('{Enter}')

    await expect(args.onQueryChange).toHaveBeenCalledWith(
      'is:todo is:in_progress sort:updated',
    )
  },
}

export const EscapeResetsFreeTextInput: Story = {
  play: async ({ canvas, args }) => {
    const input = canvas.getByRole('textbox', { name: 'Filter query' })
    await userEvent.type(input, 'has:pages')
    await userEvent.keyboard('{Escape}')

    await expect(input).toHaveValue('')
    await expect(args.onQueryChange).not.toHaveBeenCalled()
  },
}

// Backspace at the start of the (empty) free-text input clears whichever
// applied condition sits closest to it, without requiring a trip through
// that chip's own menu.
export const BackspaceOnEmptyInputRemovesLastChip: Story = {
  args: {
    parsed: { ...defaultParsed, label: 'dev:tq' },
  },
  play: async ({ canvas, args }) => {
    const input = canvas.getByRole('textbox', { name: 'Filter query' })
    await userEvent.click(input)
    await userEvent.keyboard('{Backspace}')

    await expect(args.onQueryChange).toHaveBeenCalledWith(
      'is:todo is:in_progress sort:updated',
    )
  },
}

// Pins the priority order documented on removeLastChip: with both a parent
// and a label chip applied, Backspace clears the parent chip (closest to
// the input) and leaves the label chip untouched.
export const BackspaceOnEmptyInputRemovesParentBeforeLabel: Story = {
  args: {
    parsed: { ...defaultParsed, parentId: 'parent-abc', label: 'dev:tq' },
  },
  play: async ({ canvas, args }) => {
    const input = canvas.getByRole('textbox', { name: 'Filter query' })
    await userEvent.click(input)
    await userEvent.keyboard('{Backspace}')

    await expect(args.onQueryChange).toHaveBeenCalledWith(
      'is:todo is:in_progress label:dev:tq sort:updated',
    )
  },
}
