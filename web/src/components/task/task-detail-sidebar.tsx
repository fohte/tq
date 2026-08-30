import { useEffect, useRef, useState } from 'react'

import {
  fieldValueClassName,
  SidebarField,
} from '#components/task/sidebar-field'
import { SidebarParentField } from '#components/task/sidebar-parent-field'
import { SidebarProjectField } from '#components/task/sidebar-project-field'
import { SidebarTagsField } from '#components/task/sidebar-tags-field'
import { SidebarGithubLinkField } from '#components/task/task-github-link-field'
import { DetailSidebarPanel } from '#components/ui/detail-sidebar-panel'
import { Input } from '#components/ui/input'
import { SectionLabel } from '#components/ui/section-label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'
import type { TaskDetail } from '#hooks/use-tasks'
import { useUpdateTask, useUpdateTaskStatus } from '#hooks/use-tasks'
import { selectValueHandler } from '#lib/form-utils'
import { formatMinutes } from '#lib/format'
import { parseDurationToMinutes } from '#lib/parse-duration'
import { cn } from '#lib/utils'

// --- Sidebar (PC) ---

export function TaskSidebar({ task }: { task: TaskDetail }) {
  return (
    <DetailSidebarPanel>
      <SectionLabel>DETAILS</SectionLabel>
      <SidebarStatusField taskId={task.id} status={task.status} />
      <SidebarEstimateField
        taskId={task.id}
        estimatedMinutes={task.estimatedMinutes}
      />
      <SidebarDateField
        taskId={task.id}
        field="startDate"
        label="START"
        value={task.startDate}
      />
      <SidebarDateField
        taskId={task.id}
        field="dueDate"
        label="DUE"
        value={task.dueDate}
      />
      <SidebarParentField taskId={task.id} parentId={task.parentId} />
      <SidebarContextField taskId={task.id} context={task.context} />
      <SidebarCommitmentField taskId={task.id} commitment={task.commitment} />
      <SidebarProjectField taskId={task.id} projectId={task.projectId} />
      <SidebarTagsField taskId={task.id} labels={task.labels} />
      <SidebarGithubLinkField githubLinks={task.githubLinks} />
      <SidebarTimeBlocks timeBlocks={task.timeBlocks} />
    </DetailSidebarPanel>
  )
}

// --- Sidebar (SP) ---

function MobileFieldCell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('border-b border-border p-2.5 last:border-b-0', className)}
    >
      {children}
    </div>
  )
}

export function TaskSidebarMobile({ task }: { task: TaskDetail }) {
  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>DETAILS</SectionLabel>
      <div className="grid grid-cols-2 border border-border">
        <MobileFieldCell>
          <SidebarStatusField taskId={task.id} status={task.status} />
        </MobileFieldCell>
        <MobileFieldCell>
          <SidebarEstimateField
            taskId={task.id}
            estimatedMinutes={task.estimatedMinutes}
          />
        </MobileFieldCell>
        <MobileFieldCell>
          <SidebarDateField
            taskId={task.id}
            field="startDate"
            label="START"
            value={task.startDate}
          />
        </MobileFieldCell>
        <MobileFieldCell>
          <SidebarDateField
            taskId={task.id}
            field="dueDate"
            label="DUE"
            value={task.dueDate}
          />
        </MobileFieldCell>
        <MobileFieldCell>
          <SidebarParentField taskId={task.id} parentId={task.parentId} />
        </MobileFieldCell>
        <MobileFieldCell>
          <SidebarContextField taskId={task.id} context={task.context} />
        </MobileFieldCell>
        <MobileFieldCell>
          <SidebarCommitmentField
            taskId={task.id}
            commitment={task.commitment}
          />
        </MobileFieldCell>
        <MobileFieldCell>
          <SidebarProjectField taskId={task.id} projectId={task.projectId} />
        </MobileFieldCell>
        <MobileFieldCell className="col-span-2">
          <SidebarTagsField taskId={task.id} labels={task.labels} />
        </MobileFieldCell>
        <MobileFieldCell className="col-span-2">
          <SidebarGithubLinkField githubLinks={task.githubLinks} />
        </MobileFieldCell>
      </div>
      <SidebarTimeBlocks timeBlocks={task.timeBlocks} />
    </div>
  )
}

// --- Sidebar Fields ---

function SidebarStatusField({
  taskId,
  status,
}: {
  taskId: string
  status: TaskDetail['status']
}) {
  const updateStatus = useUpdateTaskStatus()

  return (
    <SidebarField label="STATUS">
      <Select
        value={status}
        onValueChange={selectValueHandler(
          (value: TaskDetail['status']) => {
            updateStatus.mutate({ id: taskId, status: value })
          },
          ['todo', 'in_progress', 'completed'],
        )}
      >
        <SelectTrigger size="sm" className={fieldValueClassName}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todo">todo</SelectItem>
          <SelectItem value="in_progress">in progress</SelectItem>
          <SelectItem value="completed">completed</SelectItem>
        </SelectContent>
      </Select>
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
    <SidebarField label="ESTIMATE">
      {isEditing ? (
        <Input
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
          className={fieldValueClassName}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsEditing(true)
          }}
          className="w-full cursor-text text-left transition-colors hover:text-muted-foreground-strong"
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
  value,
}: {
  taskId: string
  field: 'startDate' | 'dueDate'
  label: string
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
    <SidebarField label={label}>
      <Input
        type="date"
        value={value ?? ''}
        onChange={handleChange}
        className={fieldValueClassName}
      />
    </SidebarField>
  )
}

function SidebarContextField({
  taskId,
  context,
}: {
  taskId: string
  context: TaskDetail['context']
}) {
  const updateTask = useUpdateTask()

  return (
    <SidebarField label="CONTEXT">
      <Select
        value={context}
        onValueChange={selectValueHandler(
          (value: TaskDetail['context']) => {
            updateTask.mutate({ id: taskId, input: { context: value } })
          },
          ['work', 'personal'],
        )}
      >
        <SelectTrigger size="sm" className={fieldValueClassName}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="work">work</SelectItem>
          <SelectItem value="personal">personal</SelectItem>
        </SelectContent>
      </Select>
    </SidebarField>
  )
}

function SidebarCommitmentField({
  taskId,
  commitment,
}: {
  taskId: string
  commitment: TaskDetail['commitment']
}) {
  const updateTask = useUpdateTask()

  return (
    <SidebarField label="COMMITMENT">
      <Select
        value={commitment}
        onValueChange={selectValueHandler(
          (value: TaskDetail['commitment']) => {
            updateTask.mutate({ id: taskId, input: { commitment: value } })
          },
          ['inbox', 'active', 'someday'],
        )}
      >
        <SelectTrigger size="sm" className={fieldValueClassName}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="inbox">inbox</SelectItem>
          <SelectItem value="active">active</SelectItem>
          <SelectItem value="someday">someday</SelectItem>
        </SelectContent>
      </Select>
    </SidebarField>
  )
}

// --- Time Blocks ---

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatBlockDate(iso: string): string {
  const d = new Date(iso)
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function formatBlockRange(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  return `${pad2(start.getHours())}:${pad2(start.getMinutes())}–${pad2(end.getHours())}:${pad2(end.getMinutes())}`
}

// No empty state: unlike Pages/Linked Tasks (user-authored content worth
// prompting for), time blocks are schedule-derived, so an empty list just
// means nothing has been scheduled yet.
function SidebarTimeBlocks({
  timeBlocks,
}: {
  timeBlocks: TaskDetail['timeBlocks']
}) {
  if (timeBlocks.length === 0) return null

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3.5">
      <span className="font-mono text-2xs text-muted-foreground-faint">
        TIME BLOCKS
      </span>
      <div className="flex flex-col gap-1.5 font-mono text-2xs text-muted-foreground-strong">
        {timeBlocks.map((block) => (
          <span key={block.id}>
            <span className="text-muted-foreground-faint">
              {formatBlockDate(block.startTime)}
            </span>{' '}
            {formatBlockRange(block.startTime, block.endTime)}
          </span>
        ))}
      </div>
    </div>
  )
}
