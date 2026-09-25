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
queryClient.setQueryData(taskKeys.detail('parent-wrap'), {
  id: 'parent-wrap',
  title: 'Review accessibility across compact task views',
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
    parsed: makeParsedQuery({ sortBy: 'created' }),
  },
}

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

export const SyntaxHelpFocused: Story = {
  args: {
    autoFocus: true,
  },
}

export const ParentIdChip: Story = {
  args: {
    parsed: { ...defaultParsed, parentId: 'parent-abc' },
  },
}

// Each applied filter chip opens a menu scoped to that axis.
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

export const OpenSortMenu: Story = {
  tags: ['desktop-only'],
  args: { defaultOpenFilter: 'sort' },
}

export const ParentAndLabelChips: Story = {
  args: {
    parsed: { ...defaultParsed, parentId: 'parent-abc', label: 'dev:tq' },
  },
}

export const ChangedFilters: Story = {
  args: {
    parsed: makeParsedQuery({
      status: ['todo', 'completed'],
      projectId: 'proj-1',
      label: 'research',
      sortBy: 'estimate',
    }),
  },
}

export const ManyFiltersWrap: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-2xl border border-border bg-background">
        <Story />
      </div>
    ),
  ],
  args: {
    parsed: makeParsedQuery({
      status: ['todo', 'completed'],
      projectId: 'proj-1',
      label: 'research',
      hasPages: true,
      parentId: 'parent-wrap',
      sortBy: 'estimate',
    }),
  },
}

export const ProjectScoped: Story = {
  args: {
    hideSaveView: true,
    disableProjectFilter: true,
    parsed: makeParsedQuery({ projectId: 'proj-1' }),
  },
}
