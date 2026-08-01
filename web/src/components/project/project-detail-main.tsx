import { Link } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'

import { summarizeTaskStatus } from '#components/project/project-detail-utils'
import { ProjectStatusBadge } from '#components/project/project-status-badge'
import {
  isProjectStatus,
  ProjectStatusMark,
} from '#components/project/project-status-mark'
import { TaskRow } from '#components/task/task-row'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import { Panel, PanelHeader } from '#components/ui/panel'
import { ProgressBar } from '#components/ui/progress-bar'
import { useDebouncedSave } from '#hooks/use-debounced-save'
import type { ProjectDetail, ProjectTask } from '#hooks/use-projects'
import { useUpdateProject } from '#hooks/use-projects'

// --- Main Content ---

export function ProjectMainContent({
  project,
  tasks,
}: {
  project: ProjectDetail
  tasks: ProjectTask[]
}) {
  const statusOrFallback = isProjectStatus(project.status)
    ? project.status
    : 'active'

  return (
    <div className="flex max-w-[760px] flex-col gap-[18px]">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
        <Link to="/projects" className="hover:text-foreground">
          projects
        </Link>
        <span className="text-muted-foreground-ghost">/</span>
        <span className="text-foreground">{project.title}</span>
      </nav>

      {/* Header: mark + title + status chip */}
      <div className="flex items-center gap-3">
        <ProjectStatusMark status={statusOrFallback} size={9} />
        <EditableProjectTitle
          projectId={project.id}
          defaultValue={project.title}
        />
        <ProjectStatusBadge status={project.status} />
      </div>

      {/* Description */}
      <ProjectDescription
        projectId={project.id}
        defaultValue={project.description}
      />

      <div className="border-t border-border" />

      {/* Task summary */}
      <ProjectTaskSummary tasks={tasks} />

      {/* Open tasks */}
      <ProjectOpenTasksPanel projectId={project.id} tasks={tasks} />
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
        className="flex-1 bg-transparent font-mono text-[22px] font-bold text-foreground outline-none"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        savingRef.current = false
        setIsEditing(true)
      }}
      className="flex-1 cursor-text text-left font-mono text-[22px] font-bold text-foreground"
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
  const { onChange, flush } = useDebouncedSave((markdown) => {
    const desc = markdown.trim() || null
    updateProject.mutate({ id: projectId, input: { description: desc } })
  })

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">Description</span>
      <div className="min-h-[120px] border border-border p-1 text-sm leading-relaxed focus-within:border-primary/50">
        <MarkdownEditor
          defaultValue={defaultValue ?? ''}
          placeholder="Add description..."
          onChange={onChange}
          viewEditToggle={{ onExitEditMode: flush }}
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
    <div className="flex flex-col gap-3 border-t border-border pt-[18px]">
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-xs font-bold text-primary">###</span>
        <span className="font-mono text-[13px] font-bold text-foreground">
          tasks
        </span>
        <span className="ml-auto whitespace-nowrap font-mono text-xs text-muted-foreground-strong">
          {completed}/{total} completed
          {total > 0 && ` (${String(Math.round(progress))}%)`}
        </span>
      </div>
      <ProgressBar percent={progress} className="h-[3px]" />
      <div className="flex gap-[22px] font-mono text-[11px] text-muted-foreground">
        <span>Todo: {todo}</span>
        <span>
          <span className="text-primary">▍</span>
          In Progress: {inProgress}
        </span>
        <span>Completed: {completed}</span>
      </div>
    </div>
  )
}

// --- Open Tasks Panel ---

function ProjectOpenTasksPanel({
  projectId,
  tasks,
}: {
  projectId: string
  tasks: ProjectTask[]
}) {
  const openTasks = tasks.filter((t) => t.status !== 'completed').slice(0, 5)

  return (
    <Panel>
      <PanelHeader>
        OPEN TASKS
        <Link
          to="/projects/$projectId/board"
          params={{ projectId }}
          className="ml-auto text-[10px] tracking-normal hover:text-foreground"
        >
          view board →
        </Link>
      </PanelHeader>
      {openTasks.length > 0 ? (
        <div>
          {openTasks.map((task) => (
            <TaskRow key={task.id} task={{ ...task, labels: [] }} />
          ))}
        </div>
      ) : (
        <div className="px-3 py-2 text-sm text-muted-foreground">
          No open tasks
        </div>
      )}
    </Panel>
  )
}
