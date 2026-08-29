import type { Meta, StoryObj } from '@storybook/react-vite'

import {
  SearchResultRow,
  searchResultRowWrapperClassName,
} from '#components/search/search-result-row'
import type { SearchResult } from '#hooks/use-search'

const baseTask: SearchResult = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 1,
  title: 'Implement task list UI',
  description: null,
  status: 'todo',
  context: 'personal',
  labels: [],
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  parentNumber: null,
  projectId: null,
  recurrenceRuleId: null,
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  childCompletionCount: { completed: 0, total: 0 },
}

function SearchResultRowWithWrapper({ task }: { task: SearchResult }) {
  return (
    <div className="w-full max-w-96">
      <div className={searchResultRowWrapperClassName(task.status)}>
        <SearchResultRow task={task} />
      </div>
    </div>
  )
}

const meta = {
  title: 'Search/SearchResultRow',
  component: SearchResultRowWithWrapper,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof SearchResultRowWithWrapper>

export default meta
type Story = StoryObj<typeof meta>

export const Todo: Story = {
  args: { task: baseTask },
}

export const InProgress: Story = {
  args: {
    task: {
      ...baseTask,
      status: 'in_progress',
      title: 'Review pull request',
    },
  },
}

export const Completed: Story = {
  args: {
    task: {
      ...baseTask,
      status: 'completed',
      title: 'Set up CI pipeline',
    },
  },
}

export const WorkContext: Story = {
  args: {
    task: {
      ...baseTask,
      context: 'work',
      title: 'Deploy to production',
      estimatedMinutes: 120,
    },
  },
}

export const PersonalContext: Story = {
  args: {
    task: {
      ...baseTask,
      context: 'personal',
      title: 'Plan weekend trip',
      estimatedMinutes: 60,
    },
  },
}

export const WithEstimate: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Write API documentation',
      estimatedMinutes: 90,
    },
  },
}

export const WithoutEstimate: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Sketch onboarding flow',
      estimatedMinutes: null,
    },
  },
}

export const LongTitle: Story = {
  args: {
    task: {
      ...baseTask,
      title:
        'Investigate and fix the intermittent flaky integration test failures in the CI pipeline for the search feature',
      estimatedMinutes: 45,
    },
  },
}

export const AllVariants: Story = {
  args: { task: baseTask },
  render: () => {
    const tasks: SearchResult[] = [
      { ...baseTask, id: '1', number: 1, title: 'Todo task (personal)' },
      {
        ...baseTask,
        id: '2',
        number: 2,
        title: 'In progress task',
        status: 'in_progress',
        estimatedMinutes: 60,
      },
      {
        ...baseTask,
        id: '3',
        number: 3,
        title: 'Completed task',
        status: 'completed',
        estimatedMinutes: 30,
      },
      {
        ...baseTask,
        id: '4',
        number: 4,
        title: 'Work context with estimate',
        context: 'work',
        estimatedMinutes: 120,
      },
    ]

    return (
      <div className="w-full max-w-96 divide-y divide-border">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={searchResultRowWrapperClassName(task.status)}
          >
            <SearchResultRow task={task} />
          </div>
        ))}
      </div>
    )
  },
}
