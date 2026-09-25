import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { fn } from 'storybook/test'

import { makeProject } from '#components/project/project-test-fixtures'
import { TaskFilterChipRow } from '#components/task/task-filter-chip-row'
import { makeParsedQuery } from '#components/task/task-filter-test-fixtures'
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

const projectA: Project = makeProject({
  id: 'proj-1',
  title: 'Website Redesign',
})

const projectB: Project = makeProject({ id: 'proj-2', title: 'Mobile App' })

const projects = [projectA, projectB]

const defaultParsed = makeParsedQuery()

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

export const SaveViewHidden: Story = {
  args: {
    hideSaveView: true,
  },
}

export const KanbanFilterRow: Story = {
  args: {
    parsed: {
      ...defaultParsed,
      projectId: 'proj-1',
      label: 'sample-label',
      hasPages: true,
      parentId: 'parent-abc',
    },
    hideStatusFilter: true,
    hideSortFilter: true,
    hideSaveView: true,
  },
}

export const NoFilters: Story = {
  args: {
    parsed: { freeText: '', sortBy: 'updated' },
  },
}

export const SortByCreated: Story = {
  // The sort chip's value text is hidden below `md` (see the `hidden
  // md:inline` span in TaskFilterChipRow), so this story is visually
  // identical to Default on the mobile viewport.
  tags: ['desktop-only'],
  args: {
    parsed: { ...defaultParsed, sortBy: 'created' },
  },
}

export const ProjectSelected: Story = {
  args: {
    parsed: { ...defaultParsed, projectId: 'proj-1' },
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
}

export const SearchHelpOpen: Story = {
  args: {
    defaultOpenSearchHelp: true,
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
export const OpenStatusMenu: Story = {
  tags: ['desktop-only'],
  args: {
    parsed: { ...defaultParsed, status: ['todo', 'completed'] },
    defaultOpenFilter: 'status',
  },
}

export const OpenProjectMenu: Story = {
  tags: ['desktop-only'],
  args: {
    parsed: { ...defaultParsed, projectId: 'proj-1' },
    defaultOpenFilter: 'project',
  },
}

export const OpenLabelMenu: Story = {
  tags: ['desktop-only'],
  args: {
    parsed: { ...defaultParsed, label: 'dev:tq' },
    defaultOpenFilter: 'label',
  },
}

export const OpenPagesMenu: Story = {
  tags: ['desktop-only'],
  args: {
    parsed: { ...defaultParsed, hasPages: true },
    defaultOpenFilter: 'pages',
  },
}

export const OpenParentMenu: Story = {
  tags: ['desktop-only'],
  args: {
    parsed: { ...defaultParsed, parentId: 'parent-abc' },
    defaultOpenFilter: 'parent',
  },
}

// Sort is pinned to the row's right edge, outside the wrapping chip area,
// and opens the same kind of menu as any other axis chip.
export const OpenSortMenu: Story = {
  tags: ['desktop-only'],
  args: {
    defaultOpenFilter: 'sort',
  },
}

export const ParentAndLabelChips: Story = {
  args: {
    parsed: { ...defaultParsed, parentId: 'parent-abc', label: 'dev:tq' },
  },
}
