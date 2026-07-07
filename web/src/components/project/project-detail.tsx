import { Link } from '@tanstack/react-router'
import { ColorDot } from '@web/components/project/color-dot'
import { statusConfig } from '@web/components/project/project-status-badge'
import { MarkdownEditor } from '@web/components/ui/markdown-editor'
import type { ProjectDetail, ProjectTask } from '@web/hooks/use-projects'
import {
  PROJECT_COLOR_PRESETS,
  useUpdateProject,
} from '@web/hooks/use-projects'
import { selectHandler } from '@web/lib/form-utils'
import { cn } from '@web/lib/utils'
import {
  Calendar,
  CalendarPlus,
  ChevronRight,
  Circle,
  Palette,
  Timer,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

function formatDate(dateStr: string | null): string | null {
  if (dateStr == null) return null
  const date = new Date(`${dateStr}T00:00:00`)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function getDaysRemaining(
  targetDate: string,
  now: Date = new Date(),
): number {
  const target = new Date(`${targetDate}T00:00:00`)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.ceil((target.getTime() - today.getTime()) / msPerDay)
}

export function summarizeTaskStatus(tasks: ProjectTask[]): {
  total: number
  todo: number
  inProgress: number
  completed: number
} {
  return {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  }
}

// --- Main Content ---

export function ProjectMainContent({
  project,
  tasks,
}: {
  project: ProjectDetail
  tasks: ProjectTask[]
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/projects" className="hover:text-foreground">
          Projects
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">{project.title}</span>
      </nav>

      {/* Color + Title */}
      <div className="flex items-center gap-3">
        <ColorDot color={project.color} size={14} />
        <EditableProjectTitle
          projectId={project.id}
          defaultValue={project.title}
        />
      </div>

      {/* Description */}
      <ProjectDescription
        projectId={project.id}
        defaultValue={project.description}
      />

      <div className="border-t border-border" />

      {/* Task summary */}
      <ProjectTaskSummary tasks={tasks} />

      {/* View Board link */}
      <Link
        to="/projects/$projectId/board"
        params={{ projectId: project.id }}
        className="text-sm font-bold text-primary hover:underline"
      >
        View Board →
      </Link>
    </div>
  )
}

// --- Sidebar (PC) ---

export function ProjectSidebar({ project }: { project: ProjectDetail }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Details
      </h3>
      <ProjectSidebarField
        label="Status"
        icon={<Circle className="size-3.5" />}
      >
        <StatusSelect projectId={project.id} status={project.status} />
      </ProjectSidebarField>
      <ProjectSidebarField
        label="Start date"
        icon={<CalendarPlus className="size-3.5" />}
      >
        <DateInput
          projectId={project.id}
          field="startDate"
          value={project.startDate}
        />
      </ProjectSidebarField>
      <ProjectSidebarField
        label="Target date"
        icon={<Calendar className="size-3.5" />}
      >
        <DateInput
          projectId={project.id}
          field="targetDate"
          value={project.targetDate}
        />
      </ProjectSidebarField>
      <ProjectSidebarField
        label="Color"
        icon={<Palette className="size-3.5" />}
      >
        <ColorSwatches projectId={project.id} color={project.color} />
      </ProjectSidebarField>
      {project.targetDate != null && (
        <>
          <div className="border-t border-border" />
          <RemainingDays targetDate={project.targetDate} />
        </>
      )}
    </div>
  )
}

// --- Sidebar (SP) ---

export function ProjectSidebarMobile({ project }: { project: ProjectDetail }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Details
      </h3>
      <div className="flex flex-col gap-2">
        <ProjectFieldRow label="Status">
          <StatusSelect projectId={project.id} status={project.status} />
        </ProjectFieldRow>
        <ProjectFieldRow label="Start date">
          <DateInput
            projectId={project.id}
            field="startDate"
            value={project.startDate}
          />
        </ProjectFieldRow>
        <ProjectFieldRow label="Target date">
          <DateInput
            projectId={project.id}
            field="targetDate"
            value={project.targetDate}
          />
        </ProjectFieldRow>
        <ProjectFieldRow label="Color">
          <ColorSwatches projectId={project.id} color={project.color} />
        </ProjectFieldRow>
      </div>
      {project.targetDate != null && (
        <>
          <div className="border-t border-border" />
          <RemainingDays targetDate={project.targetDate} />
        </>
      )}
    </div>
  )
}

// --- Editable Title ---

function EditableProjectTitle({
  projectId,
  defaultValue,
}: {
  projectId: string
  defaultValue: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(defaultValue)
  const updateProject = useUpdateProject()
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
      updateProject.mutate({ id: projectId, input: { title: trimmed } })
    } else {
      setValue(defaultValue)
    }
    setIsEditing(false)
  }, [value, defaultValue, projectId, updateProject])

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

// --- Description ---

function ProjectDescription({
  projectId,
  defaultValue,
}: {
  projectId: string
  defaultValue: string | null
}) {
  const updateProject = useUpdateProject()
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<(() => void) | null>(null)

  const handleChange = useCallback(
    (markdown: string) => {
      if (pendingRef.current) clearTimeout(pendingRef.current)
      const doSave = () => {
        const desc = markdown.trim() || null
        updateProject.mutate({ id: projectId, input: { description: desc } })
        pendingSaveRef.current = null
      }
      pendingSaveRef.current = doSave
      pendingRef.current = setTimeout(doSave, 1000)
    },
    [projectId, updateProject],
  )

  useEffect(() => {
    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current)
      pendingSaveRef.current?.()
    }
  }, [])

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">Description</span>
      <div className="min-h-[120px] rounded-lg border border-border p-1 text-sm leading-relaxed focus-within:border-primary/50">
        <MarkdownEditor
          defaultValue={defaultValue ?? ''}
          placeholder="Add description..."
          onChange={handleChange}
        />
      </div>
    </div>
  )
}

// --- Task Summary ---

function ProjectTaskSummary({ tasks }: { tasks: ProjectTask[] }) {
  const { total, todo, inProgress, completed } = summarizeTaskStatus(tasks)
  const progress = total > 0 ? (completed / total) * 100 : 0

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-bold text-foreground">Tasks</h3>

      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${String(progress)}%` }}
        />
      </div>

      <p className="font-mono text-[13px] text-foreground">
        {completed}/{total} completed
        {total > 0 && <span> ({Math.round(progress)}%)</span>}
      </p>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <StatusDot className="bg-muted-foreground" />
          Todo: {todo}
        </span>
        <span className="flex items-center gap-1.5">
          <StatusDot className="bg-primary" />
          In Progress: {inProgress}
        </span>
        <span className="flex items-center gap-1.5">
          <StatusDot color="#4CAF50" />
          Completed: {completed}
        </span>
      </div>
    </div>
  )
}

function StatusDot({
  className,
  color,
}: {
  className?: string
  color?: string
}) {
  return (
    <span
      className={cn('size-2 shrink-0 rounded-full', className)}
      style={color != null ? { backgroundColor: color } : undefined}
    />
  )
}

// --- Remaining Days ---

function RemainingDays({ targetDate }: { targetDate: string }) {
  const days = getDaysRemaining(targetDate)
  const formattedTarget = formatDate(targetDate)

  return (
    <div className="flex items-center gap-2">
      <Timer className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex flex-col">
        <span className="font-mono text-[13px] font-bold text-foreground">
          {days >= 0
            ? `${String(days)} days remaining`
            : `${String(Math.abs(days))} days overdue`}
        </span>
        <span className="text-[11px] text-muted-foreground">
          Target: {formattedTarget}
        </span>
      </div>
    </div>
  )
}

// --- Sidebar Fields ---

function ProjectSidebarField({
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

function ProjectFieldRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[100px] shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  )
}

function StatusSelect({
  projectId,
  status,
}: {
  projectId: string
  status: ProjectDetail['status']
}) {
  const updateProject = useUpdateProject()
  const statusValues = ['active', 'paused', 'completed', 'archived'] as const

  return (
    <select
      value={status}
      onChange={selectHandler((value: ProjectDetail['status']) => {
        updateProject.mutate({ id: projectId, input: { status: value } })
      }, statusValues)}
      className={cn(
        'rounded-full border-none px-2.5 py-0.5 text-xs font-medium outline-none',
        statusConfig[status].className,
      )}
    >
      {statusValues.map((value) => (
        <option key={value} value={value}>
          {statusConfig[value].label}
        </option>
      ))}
    </select>
  )
}

function DateInput({
  projectId,
  field,
  value,
}: {
  projectId: string
  field: 'startDate' | 'targetDate'
  value: string | null
}) {
  const updateProject = useUpdateProject()

  return (
    <input
      type="date"
      value={value ?? ''}
      onChange={(e) => {
        updateProject.mutate({
          id: projectId,
          input: { [field]: e.target.value || null },
        })
      }}
      className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs outline-none focus:border-primary/50"
    />
  )
}

function ColorSwatches({
  projectId,
  color,
}: {
  projectId: string
  color: string | null
}) {
  const updateProject = useUpdateProject()

  return (
    <div className="flex flex-wrap gap-1.5">
      {PROJECT_COLOR_PRESETS.map((preset) => (
        <button
          key={preset.hex}
          type="button"
          onClick={() => {
            updateProject.mutate({
              id: projectId,
              input: { color: preset.hex },
            })
          }}
          className={cn(
            'size-5 shrink-0 rounded-full transition-all',
            color === preset.hex
              ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
              : 'hover:scale-110',
          )}
          style={{ backgroundColor: preset.hex }}
          title={preset.name}
        />
      ))}
    </div>
  )
}
