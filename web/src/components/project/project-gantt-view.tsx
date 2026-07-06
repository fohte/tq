import type { IApi } from '@svar-ui/react-gantt'
import { Gantt } from '@svar-ui/react-gantt'
import { useNavigate } from '@tanstack/react-router'
import { SegmentedControl } from '@web/components/ui/segmented-control'
import type { ProjectTask } from '@web/hooks/use-projects'
import { useUpdateTask } from '@web/hooks/use-tasks'
import {
  addDays,
  buildGanttTasks,
  GANTT_TASK_TYPES,
  type GanttScale,
  getScaleConfig,
  toDateOnlyString,
} from '@web/lib/gantt-utils'
import { useCallback, useEffect, useMemo, useState } from 'react'

const DESKTOP_QUERY = '(min-width: 768px)'

const SCALE_OPTIONS: Array<{ value: GanttScale; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia(DESKTOP_QUERY).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY)
    const handler = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches)
    }
    mql.addEventListener('change', handler)
    return () => {
      mql.removeEventListener('change', handler)
    }
  }, [])

  return isDesktop
}

const GANTT_COLUMNS = [{ id: 'text', header: 'Task', flexgrow: 1 }]

export function ProjectGanttView({ tasks }: { tasks: ProjectTask[] }) {
  const navigate = useNavigate()
  const updateTask = useUpdateTask()
  const isDesktop = useIsDesktop()
  const [scale, setScale] = useState<GanttScale>('week')
  const [api, setApi] = useState<IApi | null>(null)

  const ganttTasks = useMemo(() => buildGanttTasks(tasks), [tasks])
  const scales = useMemo(() => getScaleConfig(scale), [scale])
  const markers = useMemo(
    () => [{ start: new Date(), css: 'tq-today-marker' }],
    [],
  )

  const handleSelectTask = useCallback(
    (ev: { id: string | number }) => {
      void navigate({
        to: '/tasks/$taskId',
        params: { taskId: String(ev.id) },
      })
    },
    [navigate],
  )

  const handleUpdateTask = useCallback(
    (ev: {
      id: string | number
      task: { start?: Date; end?: Date }
      inProgress?: boolean
    }) => {
      if (ev.inProgress === true) return

      const input: { startDate?: string; dueDate?: string } = {}
      if (ev.task.start) input.startDate = toDateOnlyString(ev.task.start)
      if (ev.task.end)
        input.dueDate = toDateOnlyString(addDays(ev.task.end, -1))
      if (input.startDate == null && input.dueDate == null) return

      updateTask.mutate({ id: String(ev.id), input })
    },
    [updateTask],
  )

  const scrollToToday = useCallback(() => {
    void api?.exec('scroll-chart', { date: new Date() })
  }, [api])

  return (
    <div className="tq-gantt flex h-full flex-col">
      <div className="flex items-center justify-end gap-2 border-b border-border px-4 py-2">
        <button
          type="button"
          onClick={scrollToToday}
          className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          Today
        </button>
        <SegmentedControl
          value={scale}
          options={SCALE_OPTIONS}
          onChange={setScale}
          activeClassName="bg-primary text-primary-foreground"
          inactiveClassName="text-muted-foreground hover:bg-secondary hover:text-foreground"
        />
      </div>

      <div className="min-h-0 flex-1">
        <Gantt
          init={setApi}
          tasks={ganttTasks}
          scales={scales}
          taskTypes={GANTT_TASK_TYPES}
          columns={GANTT_COLUMNS}
          gridWidth={isDesktop ? 280 : 160}
          cellHeight={32}
          markers={markers}
          unscheduledTasks={true}
          readonly={!isDesktop}
          onSelectTask={handleSelectTask}
          onUpdateTask={handleUpdateTask}
        />
      </div>
    </div>
  )
}
