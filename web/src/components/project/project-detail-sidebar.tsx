import { Timer } from 'lucide-react'

import {
  formatDate,
  getDaysRemaining,
} from '#components/project/project-detail-utils'
import { statusLabels } from '#components/project/project-status-badge'
import { contextLabels } from '#components/task/create-task-modal-fields'
import { Button } from '#components/ui/button'
import { DetailSidebarPanel } from '#components/ui/detail-sidebar-panel'
import { Input } from '#components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'
import type { ProjectDetail } from '#hooks/use-projects'
import { PROJECT_COLOR_PRESETS, useUpdateProject } from '#hooks/use-projects'
import { selectValueHandler } from '#lib/form-utils'
import { cn } from '#lib/utils'

// --- Sidebar (PC) ---

export function ProjectSidebar({ project }: { project: ProjectDetail }) {
  return (
    <DetailSidebarPanel>
      <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
        DETAILS
      </span>
      <ProjectSidebarField label="STATUS">
        <StatusSelect projectId={project.id} status={project.status} />
      </ProjectSidebarField>
      <ProjectSidebarField label="CONTEXT">
        <ContextSelect projectId={project.id} context={project.context} />
      </ProjectSidebarField>
      <ProjectSidebarField label="START DATE">
        <DateInput
          projectId={project.id}
          field="startDate"
          value={project.startDate}
        />
      </ProjectSidebarField>
      <ProjectSidebarField label="TARGET DATE">
        <DateInput
          projectId={project.id}
          field="targetDate"
          value={project.targetDate}
        />
      </ProjectSidebarField>
      <ProjectSidebarField label="COLOR">
        <ColorSwatches projectId={project.id} color={project.color} />
      </ProjectSidebarField>
      {project.targetDate != null && (
        <>
          <div className="border-t border-border" />
          <RemainingDays targetDate={project.targetDate} />
        </>
      )}
    </DetailSidebarPanel>
  )
}

// --- Sidebar (SP) ---

export function ProjectSidebarMobile({ project }: { project: ProjectDetail }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
        DETAILS
      </span>
      <div className="flex flex-col gap-2">
        <ProjectFieldRow label="STATUS">
          <StatusSelect projectId={project.id} status={project.status} />
        </ProjectFieldRow>
        <ProjectFieldRow label="CONTEXT">
          <ContextSelect projectId={project.id} context={project.context} />
        </ProjectFieldRow>
        <ProjectFieldRow label="START DATE">
          <DateInput
            projectId={project.id}
            field="startDate"
            value={project.startDate}
          />
        </ProjectFieldRow>
        <ProjectFieldRow label="TARGET DATE">
          <DateInput
            projectId={project.id}
            field="targetDate"
            value={project.targetDate}
          />
        </ProjectFieldRow>
        <ProjectFieldRow label="COLOR">
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

// --- Remaining Days ---

function RemainingDays({ targetDate }: { targetDate: string }) {
  const days = getDaysRemaining(targetDate)
  const formattedTarget = formatDate(targetDate)

  return (
    <div className="flex items-center gap-2">
      <Timer className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex flex-col">
        <span className="font-mono text-sm font-bold text-foreground">
          {days >= 0
            ? `${String(days)} days remaining`
            : `${String(Math.abs(days))} days overdue`}
        </span>
        <span className="text-2xs text-muted-foreground-faint">
          Target: {formattedTarget}
        </span>
      </div>
    </div>
  )
}

// --- Sidebar Fields ---

function ProjectSidebarField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-2xs text-muted-foreground-faint">
        {label}
      </span>
      <div className="font-mono text-xs text-foreground">{children}</div>
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
      <span className="w-25 shrink-0 font-mono text-2xs text-muted-foreground-faint">
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
    <Select
      items={statusValues.map((value) => ({
        value,
        label: statusLabels[value],
      }))}
      value={status}
      onValueChange={selectValueHandler((value: ProjectDetail['status']) => {
        updateProject.mutate({ id: projectId, input: { status: value } })
      }, statusValues)}
    >
      <SelectTrigger
        size="sm"
        iconClassName="size-3 text-foreground"
        className="h-auto data-[size=sm]:h-auto w-fit min-w-19 border-0 bg-transparent dark:bg-transparent hover:bg-transparent dark:hover:bg-transparent p-0 pl-1 py-px font-mono text-xs text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statusValues.map((value) => (
          <SelectItem key={value} value={value}>
            {statusLabels[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ContextSelect({
  projectId,
  context,
}: {
  projectId: string
  context: ProjectDetail['context']
}) {
  const updateProject = useUpdateProject()
  const contextValues = ['work', 'personal'] as const

  return (
    <Select
      items={contextValues.map((value) => ({
        value,
        label: contextLabels[value],
      }))}
      value={context}
      onValueChange={selectValueHandler((value: ProjectDetail['context']) => {
        updateProject.mutate({ id: projectId, input: { context: value } })
      }, contextValues)}
    >
      <SelectTrigger
        size="sm"
        iconClassName="size-3 text-foreground"
        className="h-auto data-[size=sm]:h-auto w-fit min-w-19 border-0 bg-transparent dark:bg-transparent hover:bg-transparent dark:hover:bg-transparent p-0 pl-1 py-px font-mono text-xs text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {contextValues.map((value) => (
          <SelectItem key={value} value={value}>
            {contextLabels[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
    <Input
      type="date"
      value={value ?? ''}
      onChange={(e) => {
        updateProject.mutate({
          id: projectId,
          input: { [field]: e.target.value || null },
        })
      }}
      className="h-auto w-full rounded-none border border-border bg-transparent dark:bg-transparent px-2 py-1 font-mono text-xs md:text-xs text-foreground shadow-none outline-none focus-visible:border-primary/50 focus-visible:ring-0"
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
        <Button
          key={preset.hex}
          type="button"
          variant="ghost"
          onClick={() => {
            updateProject.mutate({
              id: projectId,
              input: { color: preset.hex },
            })
          }}
          className={cn(
            'size-5 shrink-0 rounded-none border-0 bg-(--project-color) bg-clip-border p-0 transition-all hover:bg-(--project-color) active:translate-y-0',
            color === preset.hex
              ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
              : 'hover:scale-110',
          )}
          style={
            { '--project-color': preset.hex } as React.CSSProperties & {
              '--project-color': string
            }
          }
          title={preset.name}
        />
      ))}
    </div>
  )
}
