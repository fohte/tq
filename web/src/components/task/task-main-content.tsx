import { Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'

import { GithubLinkBadge } from '#components/task/github-link-badge'
import { LlmAuthorLabel } from '#components/task/llm-author-label'
import { StatusIcon } from '#components/task/status-icon'
import { TaskActivity } from '#components/task/task-activity'
import { TaskLinkedTasksSection } from '#components/task/task-linked-tasks-section'
import {
  TaskPagesList,
  TaskPagesSection,
} from '#components/task/task-pages-section'
import { Chip } from '#components/ui/chip'
import { Input } from '#components/ui/input'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import { useDebouncedSave } from '#hooks/use-debounced-save'
import { useTagFilter } from '#hooks/use-tag-filter'
import type { TaskPage } from '#hooks/use-task-pages'
import type { TaskDetail } from '#hooks/use-tasks'
import { useUpdateTask, useUpdateTaskStatus } from '#hooks/use-tasks'
import { formatRelativeTime } from '#lib/format'

// --- Main Content ---

export function TaskMainContent({
  task,
  pages,
}: {
  task: TaskDetail
  pages?: TaskPage[]
}) {
  return (
    <div className="flex max-w-[720px] flex-col gap-[18px]">
      {/* Breadcrumb */}
      <TaskBreadcrumb task={task} />

      {/* Status + Title */}
      <div className="flex items-start gap-3">
        <TaskStatusToggle taskId={task.id} status={task.status} />
        <EditableTitle
          taskId={task.id}
          defaultValue={task.title}
          author={task.titleAuthor}
        />
      </div>

      {/* Tag / Context / GitHub chips */}
      <div className="flex flex-wrap gap-2">
        {task.labels.length > 0 && <TaskTagChips labels={task.labels} />}
        <Chip>{task.context}</Chip>
        {task.githubLink != null && <GithubLinkBadge link={task.githubLink} />}
      </div>

      {/* Description */}
      <TaskDescription
        taskId={task.id}
        defaultValue={task.description}
        author={task.descriptionAuthor}
      />

      {/* Pages */}
      {pages ? (
        <TaskPagesList taskId={task.id} pages={pages} />
      ) : (
        <TaskPagesSection taskId={task.id} />
      )}

      {/* Linked Tasks */}
      <TaskLinkedTasksSection
        outgoing={task.links.outgoing}
        incoming={task.links.incoming}
      />

      {/* Activity */}
      <div className="border-t border-border pt-4">
        <TaskActivity taskId={task.id} />
      </div>
    </div>
  )
}

// --- Tag Chips ---

function TaskTagChips({ labels }: { labels: string[] }) {
  const { setTag } = useTagFilter()
  const navigate = useNavigate()

  return (
    <>
      {labels.map((label) => (
        <Chip
          key={label}
          as="button"
          size="sm"
          onClick={() => {
            setTag(label)
            void navigate({ to: '/tasks' })
          }}
        >
          <span className="text-primary font-bold">#</span>
          {label}
        </Chip>
      ))}
    </>
  )
}

// --- Breadcrumb ---

function TaskBreadcrumb({ task }: { task: TaskDetail }) {
  return (
    <nav className="flex items-center gap-[7px] font-mono text-[11px] text-muted-foreground">
      <Link to="/tasks" className="hover:text-foreground">
        tasks
      </Link>
      <span className="text-muted-foreground-ghost">/</span>
      <span className="text-foreground">#{task.number}</span>
      <span className="ml-auto text-muted-foreground-faint">
        opened {task.createdAt.slice(0, 10)} · updated{' '}
        {formatRelativeTime(task.updatedAt)}
      </span>
    </nav>
  )
}

// --- Status Toggle ---

function TaskStatusToggle({
  taskId,
  status,
}: {
  taskId: string
  status: TaskDetail['status']
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
    <button type="button" onClick={handleToggle} className="mt-1 shrink-0">
      <StatusIcon status={status} />
    </button>
  )
}

// --- Editable Title ---

function EditableTitle({
  taskId,
  defaultValue,
  author,
}: {
  taskId: string
  defaultValue: string
  author?: TaskDetail['titleAuthor']
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

  return (
    <>
      {isEditing ? (
        <Input
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
          className="h-auto flex-1 border-0 bg-transparent p-0 text-[23px] font-bold leading-[1.4] text-foreground shadow-none focus-visible:ring-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsEditing(true)
          }}
          className="flex-1 cursor-text text-left text-[23px] font-bold leading-[1.4] text-foreground"
        >
          {value}
        </button>
      )}
      <span className="mt-2 shrink-0">
        <LlmAuthorLabel author={author} />
      </span>
    </>
  )
}

// --- Description ---

function TaskDescription({
  taskId,
  defaultValue,
  author,
}: {
  taskId: string
  defaultValue: string | null
  author?: TaskDetail['descriptionAuthor']
}) {
  const updateTask = useUpdateTask()
  const { onChange, flush } = useDebouncedSave((markdown) => {
    const desc = markdown.trim() || null
    updateTask.mutate({ id: taskId, input: { description: desc } })
  })

  return (
    <div className="flex flex-col gap-1.5">
      <LlmAuthorLabel author={author} />
      <div className="min-h-[120px] border border-border p-4 text-sm leading-[1.75] focus-within:border-ring">
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
