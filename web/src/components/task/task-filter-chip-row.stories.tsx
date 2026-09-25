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

export const Default: Story = {
  name: 'the row shows the default status and sort filters.',
}

export const SaveViewHidden: Story = {
  name: 'the row hides the save-view action.',
  args: {
    hideSaveView: true,
  },
}

export const NoFilters: Story = {
  name: 'the row shows no conditions beside the default sort control.',
  args: {
    parsed: { freeText: '', sortBy: 'updated' },
  },
}

export const SortByCreated: Story = {
  name: 'the row sorts tasks by creation date.',
  // The sort chip's value text is hidden below `md` (see the `hidden
  // md:inline` span in TaskFilterChipRow), so this story is visually
  // identical to Default on the mobile viewport.
  tags: ['desktop-only'],
  args: {
    parsed: { ...defaultParsed, sortBy: 'created' },
  },
}

export const ProjectSelected: Story = {
  name: 'the row shows a selected project filter.',
  args: {
    parsed: { ...defaultParsed, projectId: 'proj-1' },
  },
}

export const LabelSelected: Story = {
  name: 'the row shows a selected label filter.',
  args: {
    parsed: { ...defaultParsed, label: 'dev:tq' },
  },
}

export const HasPagesChip: Story = {
  name: 'the row filters for tasks that have pages.',
  args: {
    parsed: { ...defaultParsed, hasPages: true },
  },
}

export const FreeTextInInput: Story = {
  name: 'the search input contains a free-text query.',
  args: {
    parsed: { ...defaultParsed, freeText: 'foo bar' },
  },
}

export const SearchHelpOpen: Story = {
  name: 'the search syntax help is open.',
  args: {
    defaultOpenSearchHelp: true,
  },
}

export const ParentIdChip: Story = {
  name: 'the row shows a parent filter by its task title.',
  args: {
    parsed: { ...defaultParsed, parentId: 'parent-abc' },
  },
}

// Every applied filter chip opens a menu scoped to just that axis, where
// both changing the value and removing the condition happen — no need to
// leave the chip and re-add the condition elsewhere.
export const OpenStatusMenu: Story = {
  name: 'the status filter menu is open.',
  tags: ['desktop-only'],
  args: {
    parsed: { ...defaultParsed, status: ['todo', 'completed'] },
    defaultOpenFilter: 'status',
  },
}

export const OpenProjectMenu: Story = {
  name: 'the project filter menu is open.',
  tags: ['desktop-only'],
  args: {
    parsed: { ...defaultParsed, projectId: 'proj-1' },
    defaultOpenFilter: 'project',
  },
}

export const OpenLabelMenu: Story = {
  name: 'the label filter menu is open.',
  tags: ['desktop-only'],
  args: {
    parsed: { ...defaultParsed, label: 'dev:tq' },
    defaultOpenFilter: 'label',
  },
}

export const OpenPagesMenu: Story = {
  name: 'the pages filter menu is open.',
  tags: ['desktop-only'],
  args: {
    parsed: { ...defaultParsed, hasPages: true },
    defaultOpenFilter: 'pages',
  },
}

export const OpenParentMenu: Story = {
  name: 'the parent filter menu is open.',
  tags: ['desktop-only'],
  args: {
    parsed: { ...defaultParsed, parentId: 'parent-abc' },
    defaultOpenFilter: 'parent',
  },
}

// Sort is pinned to the row's right edge, outside the wrapping chip area,
// and opens the same kind of menu as any other axis chip.
export const OpenSortMenu: Story = {
  name: 'the sort menu is open.',
  tags: ['desktop-only'],
  args: {
    defaultOpenFilter: 'sort',
  },
}

export const ParentAndLabelChips: Story = {
  name: 'the row shows parent and label filters together.',
  args: {
    parsed: { ...defaultParsed, parentId: 'parent-abc', label: 'dev:tq' },
  },
}
