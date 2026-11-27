import { Button } from '@fohte/ui/button'
import { FieldTrigger } from '@fohte/ui/field-trigger'
import { Input } from '@fohte/ui/input'
import { Link, useNavigate } from '@tanstack/react-router'
import type { ParsedQuery } from 'api/search-query-parser'
import { buildSearchQuery } from 'api/search-query-parser'
import { Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { LinkExistingProjectTaskMenu } from '#components/project/link-existing-project-task-menu'
import { ProjectFieldsLoadError } from '#components/project/project-fields-load-error'
import { ProjectStatusBadge } from '#components/project/project-status-badge'
import {
  isProjectStatus,
  ProjectStatusMark,
} from '#components/project/project-status-mark'
import { ProjectTaskFieldGroup } from '#components/project/project-task-field-group'
import { ProjectTaskGroupByFilter } from '#components/project/project-task-group-by-filter'
import { CreateTaskModal } from '#components/task/create-task-modal'
import { FloatingActionButton } from '#components/task/floating-action-button'
import { getProjectFieldOptionLabel } from '#components/task/project-field-filter-utils'
import { TaskFilterChipRow } from '#components/task/task-filter-chip-row'
import { TaskTreeList } from '#components/task/task-tree-list'
import { EditableMarkdownDescription } from '#components/ui/editable-markdown-description'
import { ProgressBar } from '#components/ui/progress-bar'
import { useDebouncedSave } from '#hooks/use-debounced-save'
import { useFilteredTaskTree } from '#hooks/use-filtered-tasks'
import type { ProjectField } from '#hooks/use-project-fields'
import type { ProjectDetail, ProjectTask } from '#hooks/use-projects'
import { useUpdateProject } from '#hooks/use-projects'
import type { TaskAgentSession } from '#hooks/use-task-agent-sessions'
import type { TaskListFilter, TreeNode } from '#hooks/use-tasks'
import { withDefaultSort, withField, withProjectId } from '#lib/tasks-query'

// --- Main Content ---

export function ProjectMainContent({
  project,
  parsedQuery,
  onQueryChange,
  tree,
  filteredTasks,
  isTasksLoading,
  lazyChildrenFilter,
  sessionsByTaskId,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  fetchNextPage,
  projectFields,
  groupByField,
  onGroupByChange,
  hasProjectFieldsError,
  onProjectFieldsRetry,
}: {
  project: ProjectDetail
  parsedQuery: ParsedQuery
  onQueryChange: (query: string) => void
  tree: TreeNode[]
  filteredTasks: ProjectTask[]
  isTasksLoading: boolean
  lazyChildrenFilter: TaskListFilter<'row'> | undefined
  sessionsByTaskId: ReadonlyMap<string, TaskAgentSession[]>
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  fetchNextPage: () => void
  projectFields?: ProjectField[] | undefined
  groupByField?: ProjectField | undefined
  onGroupByChange?: ((fieldId: string | undefined) => void) | undefined
  hasProjectFieldsError?: boolean | undefined
  onProjectFieldsRetry?: (() => void) | undefined
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
      <ProjectTaskSummary project={project} />

      {/* Task list */}
      <ProjectTaskList
        projectId={project.id}
        projectTitle={project.title}
        parsedQuery={parsedQuery}
        onQueryChange={onQueryChange}
        tree={tree}
        filteredTasks={filteredTasks}
        isLoading={isTasksLoading}
        lazyChildrenFilter={lazyChildrenFilter}
        sessionsByTaskId={sessionsByTaskId}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        isFetchNextPageError={isFetchNextPageError}
        fetchNextPage={fetchNextPage}
        projectFields={projectFields}
        groupByField={groupByField}
        onGroupByChange={onGroupByChange}
        hasProjectFieldsError={hasProjectFieldsError}
        onProjectFieldsRetry={onProjectFieldsRetry}
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
      <Input
        type="text"
        variant="ghost"
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
        className="flex-1"
      />
    )
  }

  return (
    <div className="min-w-0 flex-1 break-words font-mono text-2xl font-bold text-foreground">
      <FieldTrigger
        onClick={() => {
          savingRef.current = false
          setIsEditing(true)
        }}
        className="w-full min-w-0 whitespace-normal"
      >
        {value}
      </FieldTrigger>
    </div>
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
    <EditableMarkdownDescription
      variant="project"
      defaultValue={defaultValue}
      header={
        <span className="text-xs text-muted-foreground">Description</span>
      }
      placeholder="Add description..."
      editButtonLabel="Edit project description"
      onChange={onChange}
      onExitEditMode={flush}
    />
  )
}

// --- Task Summary ---

function ProjectTaskSummary({ project }: { project: ProjectDetail }) {
  const { total, completed } = project.taskCount
  const todo = total - completed
  const progress = project.completionRate * 100

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
        <span>Completed: {completed}</span>
      </div>
    </div>
  )
}

// --- Task List ---

function ProjectTaskList({
  projectId,
  projectTitle,
  parsedQuery,
  onQueryChange,
  tree,
  filteredTasks,
  isLoading,
  lazyChildrenFilter,
  sessionsByTaskId,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  fetchNextPage,
  projectFields,
  groupByField,
  onGroupByChange,
  hasProjectFieldsError,
  onProjectFieldsRetry,
}: {
  projectId: string
  projectTitle: string
  parsedQuery: ParsedQuery
  onQueryChange: (query: string) => void
  tree: TreeNode[]
  filteredTasks: ProjectTask[]
  isLoading: boolean
  lazyChildrenFilter: TaskListFilter<'row'> | undefined
  sessionsByTaskId: ReadonlyMap<string, TaskAgentSession[]>
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  fetchNextPage: () => void
  projectFields?: ProjectField[] | undefined
  groupByField?: ProjectField | undefined
  onGroupByChange?: ((fieldId: string | undefined) => void) | undefined
  hasProjectFieldsError?: boolean | undefined
  onProjectFieldsRetry?: (() => void) | undefined
}) {
  const navigate = useNavigate()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLinkExistingOpen, setIsLinkExistingOpen] = useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-end gap-1">
        {projectFields != null &&
          projectFields.length > 0 &&
          onGroupByChange != null && (
            <ProjectTaskGroupByFilter
              fields={projectFields}
              selectedFieldId={groupByField?.id}
              onChange={onGroupByChange}
            />
          )}
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

      {hasProjectFieldsError === true && onProjectFieldsRetry != null && (
        <ProjectFieldsLoadError onRetry={onProjectFieldsRetry} />
      )}

      <div className="border border-border">
        <TaskFilterChipRow
          onQueryChange={onQueryChange}
          parsed={parsedQuery}
          hideSaveView={projectFields == null || projectFields.length === 0}
          disableProjectFilter
          projectFields={projectFields}
          saveViewQuery={buildSearchQuery(
            withDefaultSort(withProjectId(parsedQuery, projectId)),
          )}
        />
        {groupByField == null ? (
          <TaskTreeList
            isLoading={isLoading}
            tree={tree}
            tasks={filteredTasks}
            sessionsByTaskId={sessionsByTaskId}
            lazyChildrenFilter={lazyChildrenFilter}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isFetchNextPageError={isFetchNextPageError}
            fetchNextPage={fetchNextPage}
          />
        ) : (
          getFieldGroups(groupByField, parsedQuery).map((group) => (
            <ProjectTaskFieldGroupContents
              key={group.key}
              title={group.name}
              projectId={projectId}
              q={group.q}
              sessionsByTaskId={sessionsByTaskId}
            />
          ))
        )}
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
        onCreated={(task) => {
          void navigate({ to: '/tasks/$taskId', params: { taskId: task.id } })
        }}
      />

      {/* Link existing task menu */}
      <LinkExistingProjectTaskMenu
        open={isLinkExistingOpen}
        onOpenChange={setIsLinkExistingOpen}
        projectId={projectId}
        projectTitle={projectTitle}
      />
    </div>
  )
}

function getFieldGroups(field: ProjectField, parsedQuery: ParsedQuery) {
  const hasFilter = Object.hasOwn(parsedQuery.fields ?? {}, field.name)
  const selectedValue = parsedQuery.fields?.[field.name]
  const groups = [
    ...field.options.map((option) => ({
      key: `option:${option.id}`,
      name: getProjectFieldOptionLabel(option.name),
      value: option.name,
    })),
    { key: 'unset', name: 'Unset', value: null },
  ]

  return groups
    .filter((group) => !hasFilter || group.value === selectedValue)
    .map((group) => ({
      ...group,
      q: buildSearchQuery(
        withDefaultSort(withField(parsedQuery, field.name, group.value)),
      ),
    }))
}

function ProjectTaskFieldGroupContents({
  title,
  projectId,
  q,
  sessionsByTaskId,
}: {
  title: string
  projectId: string
  q: string
  sessionsByTaskId: ReadonlyMap<string, TaskAgentSession[]>
}) {
  const taskList = useFilteredTaskTree({ q, projectId })

  return (
    <ProjectTaskFieldGroup
      title={title}
      isError={taskList.isError && taskList.tasks.length === 0}
    >
      <TaskTreeList
        isLoading={taskList.isLoading}
        tree={taskList.tree}
        tasks={taskList.tasks}
        sessionsByTaskId={sessionsByTaskId}
        lazyChildrenFilter={taskList.lazyChildrenFilter}
        hasNextPage={taskList.hasNextPage}
        isFetchingNextPage={taskList.isFetchingNextPage}
        isFetchNextPageError={taskList.isFetchNextPageError}
        fetchNextPage={taskList.fetchNextPage}
      />
    </ProjectTaskFieldGroup>
  )
}
