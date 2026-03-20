import { Link } from '@tanstack/react-router'
import { MarkdownEditor } from '@web/components/ui/markdown-editor'
import type { TaskDetail, UpdateTaskInput } from '@web/hooks/use-tasks'
import { useUpdateTask, useUpdateTaskStatus } from '@web/hooks/use-tasks'
import { formatMinutes, parseDurationToMinutes } from '@web/lib/parse-duration'
import { cn } from '@web/lib/utils'
import {
  Calendar,
  CalendarPlus,
  Check,
  ChevronRight,
  Circle,
  Clock,
  Layers,
  Network,
  Play,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

// --- Main Content ---

export function TaskMainContent({ task }: { task: TaskDetail }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/tasks" className="hover:text-foreground">
          Tasks
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">#{task.id.slice(0, 8)}</span>
      </nav>

      {/* Status + Title */}
      <div className="flex items-start gap-3">
        <div className="mt-1.5">
          <TaskStatusIcon taskId={task.id} status={task.status} />
        </div>
        <EditableTitle taskId={task.id} defaultValue={task.title} />
      </div>

      {/* Description */}
      <TaskDescription taskId={task.id} defaultValue={task.description} />
    </div>
  )
}

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
      <SidebarParentField parentId={task.parentId} />
      <SidebarContextField taskId={task.id} context={task.context} />
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
        <SidebarParentField parentId={task.parentId} />
        <SidebarContextField taskId={task.id} context={task.context} />
      </div>
    </div>
  )
}

// --- Editable Title ---

function EditableTitle({
  taskId,
  defaultValue,
}: {
  taskId: string
  defaultValue: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(defaultValue)
  const updateTask = useUpdateTask()
  const savingRef = useRef(false)

  useEffect(() => {
    if (!isEditing) setValue(defaultValue)
  }, [defaultValue, isEditing])

  const save = useCallback(() => {
    if (savingRef.current) return
    savingRef.current = true
    const trimmed = value.trim()
    if (trimmed && trimmed !== defaultValue) {
      updateTask.mutate({ id: taskId, input: { title: trimmed } })
    } else {
      setValue(defaultValue)
    }
    setIsEditing(false)
    savingRef.current = false
  }, [value, defaultValue, taskId, updateTask])

  const cancel = useCallback(() => {
    savingRef.current = true
    setValue(defaultValue)
    setIsEditing(false)
    savingRef.current = false
  }, [defaultValue])

  if (isEditing) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') cancel()
        }}
        autoFocus
        className="flex-1 bg-transparent text-2xl font-bold text-foreground outline-none"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="flex-1 cursor-text text-left text-2xl font-bold text-foreground"
    >
      {value}
    </button>
  )
}

// --- Status Icon ---

function TaskStatusIcon({
  taskId,
  status,
}: {
  taskId: string
  status: string
}) {
  const updateStatus = useUpdateTaskStatus()

  const handleToggle = () => {
    const nextStatus = status === 'completed' ? 'todo' : 'completed'
    updateStatus.mutate({
      id: taskId,
      status: nextStatus as 'todo' | 'in_progress' | 'completed',
    })
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors',
        status === 'completed' &&
          'border-primary bg-primary text-primary-foreground',
        status === 'in_progress' && 'border-primary text-primary',
        status === 'todo' &&
          'border-muted-foreground/40 text-muted-foreground/40 hover:border-muted-foreground hover:text-muted-foreground',
      )}
    >
      {status === 'completed' && <Check className="h-3.5 w-3.5" />}
      {status === 'in_progress' && (
        <Play className="h-3.5 w-3.5 fill-current" />
      )}
      {status === 'todo' && <Circle className="h-3.5 w-3.5" />}
    </button>
  )
}

// --- Description ---

function TaskDescription({
  taskId,
  defaultValue,
}: {
  taskId: string
  defaultValue: string | null
}) {
  const updateTask = useUpdateTask()
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<(() => void) | null>(null)

  const handleChange = useCallback(
    (markdown: string) => {
      if (pendingRef.current) clearTimeout(pendingRef.current)
      const doSave = () => {
        const desc = markdown.trim() || null
        updateTask.mutate({ id: taskId, input: { description: desc } })
        pendingSaveRef.current = null
      }
      pendingSaveRef.current = doSave
      pendingRef.current = setTimeout(doSave, 1000)
    },
    [taskId, updateTask],
  )

  useEffect(() => {
    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current)
      pendingSaveRef.current?.()
    }
  }, [])

  return (
    <div className="min-h-[120px] rounded-lg border border-border p-1 text-sm focus-within:border-primary/50">
      <MarkdownEditor
        defaultValue={defaultValue ?? ''}
        placeholder="Add description..."
        onChange={handleChange}
      />
    </div>
  )
}

// --- Sidebar Fields ---

function SidebarField({
  label,
  icon,
  children,
}: {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        {icon}
        {label}
      </span>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  )
}

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
        onChange={(e) =>
          updateStatus.mutate({
            id: taskId,
            status: e.target.value as 'todo' | 'in_progress' | 'completed',
          })
        }
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
    if (savingRef.current) return
    savingRef.current = true
    const parsed = parseDurationToMinutes(input)
    if (parsed !== estimatedMinutes) {
      updateTask.mutate({
        id: taskId,
        input: { estimatedMinutes: parsed },
      })
    }
    setIsEditing(false)
    savingRef.current = false
  }

  const cancel = () => {
    savingRef.current = true
    setInput(estimatedMinutes != null ? formatMinutes(estimatedMinutes) : '')
    setIsEditing(false)
    savingRef.current = false
  }

  return (
    <SidebarField label="Estimate" icon={<Clock className="size-3.5" />}>
      {isEditing ? (
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') cancel()
          }}
          placeholder="1h30m"
          autoFocus
          className="w-full rounded-md border border-border bg-transparent px-2 py-1 font-mono text-xs outline-none focus:border-primary/50"
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
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
      input: { [field]: newValue } as UpdateTaskInput,
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

function SidebarParentField({ parentId }: { parentId: string | null }) {
  return (
    <SidebarField label="Parent" icon={<Network className="size-3.5" />}>
      {parentId ? (
        <Link
          to="/tasks/$taskId"
          params={{ taskId: parentId }}
          className="text-xs text-primary hover:underline"
        >
          #{parentId.slice(0, 8)}
        </Link>
      ) : (
        <span className="px-2 py-1 text-xs text-muted-foreground">—</span>
      )}
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
        onChange={(e) =>
          updateTask.mutate({
            id: taskId,
            input: {
              context: e.target.value as 'work' | 'personal' | 'dev',
            },
          })
        }
        className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs outline-none focus:border-primary/50"
      >
        <option value="personal">Personal</option>
        <option value="work">Work</option>
        <option value="dev">Dev</option>
      </select>
    </SidebarField>
  )
}
