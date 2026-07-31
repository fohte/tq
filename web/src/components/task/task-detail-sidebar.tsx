import {
  Calendar,
  CalendarPlus,
  Circle,
  Clock,
  Layers,
  Network,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { SidebarField } from '#components/task/sidebar-field'
import { SidebarGithubLinkField } from '#components/task/task-github-link-field'
import type { TaskDetail } from '#hooks/use-tasks'
import {
  useTaskList,
  useUpdateTask,
  useUpdateTaskParent,
  useUpdateTaskStatus,
} from '#hooks/use-tasks'
import { selectHandler } from '#lib/form-utils'
import { formatMinutes, parseDurationToMinutes } from '#lib/parse-duration'

// --- Sidebar (PC) ---

export function TaskSidebar({ task }: { task: TaskDetail }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Details
      </h3>
      <SidebarStatusField taskId={task.id} status={task.status} />
      <SidebarEstimateField
        taskId={task.id}
        estimatedMinutes={task.estimatedMinutes}
      />
      <SidebarDateField
        taskId={task.id}
        field="startDate"
        label="Start date"
        icon={<CalendarPlus className="size-3.5" />}
        value={task.startDate}
      />
      <SidebarDateField
        taskId={task.id}
        field="dueDate"
        label="Due"
        icon={<Calendar className="size-3.5" />}
        value={task.dueDate}
      />
      <SidebarParentField taskId={task.id} parentId={task.parentId} />
      <SidebarContextField taskId={task.id} context={task.context} />
      <SidebarGithubLinkField taskId={task.id} githubLink={task.githubLink} />
    </div>
  )
}

// --- Sidebar (SP) ---

export function TaskSidebarMobile({ task }: { task: TaskDetail }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Details
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <SidebarStatusField taskId={task.id} status={task.status} />
        <SidebarEstimateField
          taskId={task.id}
          estimatedMinutes={task.estimatedMinutes}
        />
        <SidebarDateField
          taskId={task.id}
          field="startDate"
          label="Start date"
          icon={<CalendarPlus className="size-3.5" />}
          value={task.startDate}
        />
        <SidebarDateField
          taskId={task.id}
          field="dueDate"
          label="Due"
          icon={<Calendar className="size-3.5" />}
          value={task.dueDate}
        />
        <SidebarParentField taskId={task.id} parentId={task.parentId} />
        <SidebarContextField taskId={task.id} context={task.context} />
        <div className="col-span-2">
          <SidebarGithubLinkField
            taskId={task.id}
            githubLink={task.githubLink}
          />
        </div>
      </div>
    </div>
  )
}

// --- Sidebar Fields ---

function SidebarStatusField({
  taskId,
  status,
}: {
  taskId: string
  status: string
}) {
  const updateStatus = useUpdateTaskStatus()

  const statusOptions = [
    { value: 'todo', label: 'Todo' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
  ] as const

  return (
    <SidebarField label="Status" icon={<Circle className="size-3.5" />}>
      <select
        value={status}
        onChange={selectHandler(
          (value: 'todo' | 'in_progress' | 'completed') => {
            updateStatus.mutate({ id: taskId, status: value })
          },
          ['todo', 'in_progress', 'completed'],
        )}
        className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs outline-none focus:border-primary/50"
      >
        {statusOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </SidebarField>
  )
}

function SidebarEstimateField({
  taskId,
  estimatedMinutes,
}: {
  taskId: string
  estimatedMinutes: number | null
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [input, setInput] = useState(
    estimatedMinutes != null ? formatMinutes(estimatedMinutes) : '',
  )
  const updateTask = useUpdateTask()
  const savingRef = useRef(false)

  useEffect(() => {
    if (!isEditing)
      setInput(estimatedMinutes != null ? formatMinutes(estimatedMinutes) : '')
  }, [estimatedMinutes, isEditing])

  const save = () => {
    if (savingRef.current) {
      savingRef.current = false
      return
    }
    const parsed = parseDurationToMinutes(input)
    if (parsed !== estimatedMinutes) {
      updateTask.mutate({
        id: taskId,
        input: { estimatedMinutes: parsed },
      })
    }
    setIsEditing(false)
  }

  return (
    <SidebarField label="Estimate" icon={<Clock className="size-3.5" />}>
      {isEditing ? (
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
          }}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              savingRef.current = true
              setInput(
                estimatedMinutes != null ? formatMinutes(estimatedMinutes) : '',
              )
              setIsEditing(false)
            }
          }}
          placeholder="1h30m"
          autoFocus
          className="w-full rounded-md border border-border bg-transparent px-2 py-1 font-mono text-xs outline-none focus:border-primary/50"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsEditing(true)
          }}
          className="w-full cursor-text rounded-md px-2 py-1 text-left font-mono text-xs text-muted-foreground hover:bg-secondary/50"
        >
          {estimatedMinutes != null ? formatMinutes(estimatedMinutes) : '—'}
        </button>
      )}
    </SidebarField>
  )
}

function SidebarDateField({
  taskId,
  field,
  label,
  icon,
  value,
}: {
  taskId: string
  field: 'startDate' | 'dueDate'
  label: string
  icon: React.ReactNode
  value: string | null
}) {
  const updateTask = useUpdateTask()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value || null
    updateTask.mutate({
      id: taskId,
      input: { [field]: newValue },
    })
  }

  return (
    <SidebarField label={label} icon={icon}>
      <input
        type="date"
        value={value ?? ''}
        onChange={handleChange}
        className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs outline-none focus:border-primary/50"
      />
    </SidebarField>
  )
}

function SidebarParentField({
  taskId,
  parentId,
}: {
  taskId: string
  parentId: string | null
}) {
  const { categorized } = useTaskList()
  const updateParent = useUpdateTaskParent()

  const allTasks = categorized.all
  const getDescendantIds = (id: string): string[] =>
    allTasks
      .filter((t) => t.parentId === id)
      .flatMap((child) => [child.id, ...getDescendantIds(child.id)])
  const invalidParentIds = new Set([taskId, ...getDescendantIds(taskId)])
  const candidates = allTasks.filter((t) => !invalidParentIds.has(t.id))

  return (
    <SidebarField label="Parent" icon={<Network className="size-3.5" />}>
      <select
        value={parentId ?? ''}
        onChange={(e) => {
          const newParentId = e.target.value || null
          updateParent.mutate({ id: taskId, parentId: newParentId })
        }}
        className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs outline-none focus:border-primary/50"
      >
        <option value="">None</option>
        {candidates.map((t) => (
          <option key={t.id} value={t.id}>
            #{t.number} {t.title}
          </option>
        ))}
      </select>
    </SidebarField>
  )
}

function SidebarContextField({
  taskId,
  context,
}: {
  taskId: string
  context: string
}) {
  const updateTask = useUpdateTask()

  return (
    <SidebarField label="Context" icon={<Layers className="size-3.5" />}>
      <select
        value={context}
        onChange={selectHandler(
          (value: 'work' | 'personal') => {
            updateTask.mutate({ id: taskId, input: { context: value } })
          },
          ['work', 'personal'],
        )}
        className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs outline-none focus:border-primary/50"
      >
        <option value="personal">Personal</option>
        <option value="work">Work</option>
      </select>
    </SidebarField>
  )
}
