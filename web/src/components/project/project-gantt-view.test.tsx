import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectGanttView } from '@web/components/project/project-gantt-view'
import type { ProjectTask } from '@web/hooks/use-projects'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

const mockUpdateTaskMutate = vi.fn()
vi.mock('@web/hooks/use-tasks', () => ({
  useUpdateTask: () => ({ mutate: mockUpdateTaskMutate }),
}))

const mockGanttApi = {
  exec: vi.fn<(action: string, params: { date: Date }) => void>(),
}

interface MockGanttProps {
  init?: (api: typeof mockGanttApi) => void
  tasks?: unknown
  scales?: Array<{ unit: string; step: number }>
  readonly?: boolean
  gridWidth?: number
  onSelectTask?: (ev: { id: string | number }) => void
  onUpdateTask?: (ev: {
    id: string | number
    task: { start?: Date; end?: Date }
    inProgress?: boolean
  }) => void
}

const mockGanttProps: { current: MockGanttProps } = { current: {} }

vi.mock('@svar-ui/react-gantt', () => ({
  Gantt: (props: MockGanttProps) => {
    mockGanttProps.current = props
    props.init?.(mockGanttApi)
    return <div data-testid="gantt" />
  },
}))

const baseTask: ProjectTask = {
  id: '1',
  title: 'Task 1',
  description: null,
  status: 'todo',
  context: 'personal',
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  projectId: 'p1',
  sortOrder: 0,
  recurrenceRuleId: null,
  recurrenceRule: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

describe('ProjectGanttView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  })

  it('renders the Gantt chart with converted tasks', () => {
    const tasks: ProjectTask[] = [
      {
        ...baseTask,
        id: '1',
        title: 'Design',
        startDate: '2026-03-01',
        dueDate: '2026-03-05',
      },
    ]
    render(<ProjectGanttView tasks={tasks} />)

    expect(screen.getByTestId('gantt')).toBeInTheDocument()
    expect(mockGanttProps.current.tasks).toEqual([
      {
        id: '1',
        text: 'Design',
        parent: 0,
        type: 'todo',
        unscheduled: false,
        start: new Date('2026-03-01T00:00:00'),
        end: new Date('2026-03-06T00:00:00'),
      },
    ])
  })

  it('defaults to the week scale', () => {
    render(<ProjectGanttView tasks={[]} />)

    const scales = mockGanttProps.current.scales?.map((s) => ({
      unit: s.unit,
      step: s.step,
    }))
    expect(scales).toEqual([
      { unit: 'month', step: 1 },
      { unit: 'week', step: 1 },
    ])
  })

  it('switches scale when a scale button is clicked', async () => {
    const user = userEvent.setup()
    render(<ProjectGanttView tasks={[]} />)

    await user.click(screen.getByRole('button', { name: 'Month' }))

    const scales = mockGanttProps.current.scales?.map((s) => ({
      unit: s.unit,
      step: s.step,
    }))
    expect(scales).toEqual([{ unit: 'month', step: 1 }])
  })

  it('navigates to the task page when a task is selected', () => {
    render(<ProjectGanttView tasks={[]} />)

    mockGanttProps.current.onSelectTask?.({ id: 'task-1' })

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/tasks/$taskId',
      params: { taskId: 'task-1' },
    })
  })

  it('updates task dates when a drag finishes', () => {
    render(<ProjectGanttView tasks={[]} />)

    mockGanttProps.current.onUpdateTask?.({
      id: 'task-1',
      task: {
        start: new Date('2026-03-10T00:00:00'),
        end: new Date('2026-03-13T00:00:00'),
      },
    })

    expect(mockUpdateTaskMutate).toHaveBeenCalledWith({
      id: 'task-1',
      input: { startDate: '2026-03-10', dueDate: '2026-03-12' },
    })
  })

  it('updates only dueDate when a due-date-edge drag only changes the end', () => {
    render(<ProjectGanttView tasks={[]} />)

    mockGanttProps.current.onUpdateTask?.({
      id: 'task-1',
      task: { end: new Date('2026-03-13T00:00:00') },
    })

    expect(mockUpdateTaskMutate).toHaveBeenCalledWith({
      id: 'task-1',
      input: { dueDate: '2026-03-12' },
    })
  })

  it('ignores in-progress drag updates', () => {
    render(<ProjectGanttView tasks={[]} />)

    mockGanttProps.current.onUpdateTask?.({
      id: 'task-1',
      task: { start: new Date('2026-03-10T00:00:00') },
      inProgress: true,
    })

    expect(mockUpdateTaskMutate).not.toHaveBeenCalled()
  })

  it('scrolls to today when the Today button is clicked', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-15T00:00:00'))

    try {
      const user = userEvent.setup()
      render(<ProjectGanttView tasks={[]} />)

      await user.click(screen.getByRole('button', { name: 'Today' }))

      expect(mockGanttApi.exec).toHaveBeenCalledWith('scroll-chart', {
        date: new Date('2026-03-15T00:00:00'),
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('is readonly with a narrower grid on mobile viewports', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    render(<ProjectGanttView tasks={[]} />)

    expect({
      readonly: mockGanttProps.current.readonly,
      gridWidth: mockGanttProps.current.gridWidth,
    }).toEqual({ readonly: true, gridWidth: 160 })
  })

  it('is editable with a wider grid on desktop viewports', () => {
    render(<ProjectGanttView tasks={[]} />)

    expect({
      readonly: mockGanttProps.current.readonly,
      gridWidth: mockGanttProps.current.gridWidth,
    }).toEqual({ readonly: false, gridWidth: 280 })
  })
})
