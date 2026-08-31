import { Link } from '@tanstack/react-router'
import type { ParsedQuery } from 'api/search-query-parser'
import { Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { LinkExistingProjectTaskMenu } from '#components/project/link-existing-project-task-menu'
import { summarizeTaskStatus } from '#components/project/project-detail-utils'
import { ProjectStatusBadge } from '#components/project/project-status-badge'
import {
  isProjectStatus,
  ProjectStatusMark,
} from '#components/project/project-status-mark'
import { FloatingActionButton } from '#components/task/create-task-inline'
import { CreateTaskModal } from '#components/task/create-task-modal'
import { TaskFilterChipRow } from '#components/task/task-filter-chip-row'
import { TaskTreeList } from '#components/task/task-tree-list'
import { Button } from '#components/ui/button'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import { ProgressBar } from '#components/ui/progress-bar'
import { useDebouncedSave } from '#hooks/use-debounced-save'
import type { Project, ProjectDetail, ProjectTask } from '#hooks/use-projects'
import { useUpdateProject } from '#hooks/use-projects'
import type { TaskAgentSession } from '#hooks/use-task-agent-sessions'
import type { TaskListFilter, TreeNode } from '#hooks/use-tasks'

// --- Main Content ---

export function ProjectMainContent({
  project,
  tasks,
  parsedQuery,
  onQueryChange,
  projects,
  tree,
  filteredTasks,
  isTasksLoading,
  isSearching,
  baseFilter,
  sessionsByTaskId,
}: {
  project: ProjectDetail
  tasks: ProjectTask[]
  parsedQuery: ParsedQuery
  onQueryChange: (query: string) => void
  projects: Project[]
  tree: TreeNode[]
  filteredTasks: ProjectTask[]
  isTasksLoading: boolean
  isSearching: boolean
  baseFilter: TaskListFilter
  sessionsByTaskId: ReadonlyMap<string, TaskAgentSession[]>
}) {
  const statusOrFallback = isProjectStatus(project.status)
    ? project.status
    : 'active'

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 font-mono text-2xs text-muted-foreground">
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

      {/* Task list */}
      <ProjectTaskList
        projectId={project.id}
        projectTitle={project.title}
        allTasks={tasks}
        parsedQuery={parsedQuery}
        onQueryChange={onQueryChange}
        projects={projects}
        tree={tree}
        filteredTasks={filteredTasks}
        isLoading={isTasksLoading}
        isSearching={isSearching}
        baseFilter={baseFilter}
        sessionsByTaskId={sessionsByTaskId}
      />
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
        className="flex-1 bg-transparent font-mono text-2xl font-bold text-foreground outline-none"
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
      className="flex-1 cursor-text text-left font-mono text-2xl font-bold text-foreground"
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
      <div className="border border-border p-1 text-sm leading-relaxed focus-within:border-primary/50">
        <MarkdownEditor
          defaultValue={defaultValue ?? ''}
          placeholder="Add description..."
          onChange={onChange}
          viewEditToggle={{ onExitEditMode: flush }}
          size="compact"
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
    <div className="flex flex-col gap-3 border-t border-border pt-5">
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-xs font-bold text-primary">###</span>
        <span className="font-mono text-sm font-bold text-foreground">
          tasks
        </span>
        <span className="ml-auto whitespace-nowrap font-mono text-xs text-muted-foreground-strong">
          {completed}/{total} completed
          {total > 0 && ` (${String(Math.round(progress))}%)`}
        </span>
      </div>
      <ProgressBar percent={progress} className="h-1" />
      <div className="flex gap-6 font-mono text-2xs text-muted-foreground">
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

// --- Task List ---

function ProjectTaskList({
  projectId,
  projectTitle,
  allTasks,
  parsedQuery,
  onQueryChange,
  projects,
  tree,
  filteredTasks,
  isLoading,
  isSearching,
  baseFilter,
  sessionsByTaskId,
}: {
  projectId: string
  projectTitle: string
  allTasks: ProjectTask[]
  parsedQuery: ParsedQuery
  onQueryChange: (query: string) => void
  projects: Project[]
  tree: TreeNode[]
  filteredTasks: ProjectTask[]
  isLoading: boolean
  isSearching: boolean
  baseFilter: TaskListFilter
  sessionsByTaskId: ReadonlyMap<string, TaskAgentSession[]>
}) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLinkExistingOpen, setIsLinkExistingOpen] = useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            setIsLinkExistingOpen(true)
          }}
          aria-label="Link existing task"
        >
          <Search className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            setIsModalOpen(true)
          }}
          aria-label="Add task"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="border border-border">
        <TaskFilterChipRow
          onQueryChange={onQueryChange}
          parsed={parsedQuery}
          projects={projects}
          hideSaveView
          disableProjectFilter
        />
        <TaskTreeList
          isLoading={isLoading}
          tree={tree}
          tasks={filteredTasks}
          sessionsByTaskId={sessionsByTaskId}
          lazyChildrenFilter={isSearching ? undefined : baseFilter}
        />
      </div>

      {/* FAB (mobile only) */}
      <FloatingActionButton
        onClick={() => {
          setIsModalOpen(true)
        }}
      />

      {/* Task create modal */}
      <CreateTaskModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        projectId={projectId}
      />

      {/* Link existing task menu */}
      <LinkExistingProjectTaskMenu
        open={isLinkExistingOpen}
        onOpenChange={setIsLinkExistingOpen}
        projectId={projectId}
        projectTitle={projectTitle}
        excludedTaskIds={new Set(allTasks.map((t) => t.id))}
      />
    </div>
  )
}
