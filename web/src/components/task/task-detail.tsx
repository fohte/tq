import { Link } from '@tanstack/react-router'
import { Check, ChevronRight, Circle, Play } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { TaskActivity } from '#components/task/task-activity'
import {
  TaskPagesList,
  TaskPagesSection,
} from '#components/task/task-pages-section'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import type { TaskPage } from '#hooks/use-task-pages'
import type { TaskDetail } from '#hooks/use-tasks'
import { useUpdateTask, useUpdateTaskStatus } from '#hooks/use-tasks'
import { cn } from '#lib/utils'

export {
  TaskSidebar,
  TaskSidebarMobile,
} from '#components/task/task-detail-sidebar'

// --- Main Content ---

export function TaskMainContent({
  task,
  pages,
}: {
  task: TaskDetail
  pages?: TaskPage[]
}) {
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

      {/* Pages */}
      {pages ? (
        <TaskPagesList taskId={task.id} pages={pages} />
      ) : (
        <TaskPagesSection taskId={task.id} />
      )}

      {/* Activity */}
      <div className="border-t border-border pt-4">
        <TaskActivity taskId={task.id} />
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
    if (savingRef.current) {
      savingRef.current = false
      return
    }
    const trimmed = value.trim()
    if (trimmed && trimmed !== defaultValue) {
      updateTask.mutate({ id: taskId, input: { title: trimmed } })
    } else {
      setValue(defaultValue)
    }
    setIsEditing(false)
  }, [value, defaultValue, taskId, updateTask])

  if (isEditing) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            savingRef.current = true
            setValue(defaultValue)
            setIsEditing(false)
          }
        }}
        autoFocus
        className="flex-1 bg-transparent text-2xl font-bold text-foreground outline-none"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setIsEditing(true)
      }}
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
      status: nextStatus,
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
