import { Timer } from 'lucide-react'

import {
  formatDate,
  getDaysRemaining,
} from '#components/project/project-detail-utils'
import { statusLabels } from '#components/project/project-status-badge'
import type { ProjectDetail } from '#hooks/use-projects'
import { PROJECT_COLOR_PRESETS, useUpdateProject } from '#hooks/use-projects'
import { selectHandler } from '#lib/form-utils'
import { cn } from '#lib/utils'

// --- Sidebar (PC) ---

export function ProjectSidebar({ project }: { project: ProjectDetail }) {
  return (
    <div className="flex w-60 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border p-4">
      <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
        DETAILS
      </span>
      <ProjectSidebarField label="STATUS">
        <StatusSelect projectId={project.id} status={project.status} />
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
    </div>
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
    <select
      value={status}
      onChange={selectHandler((value: ProjectDetail['status']) => {
        updateProject.mutate({ id: projectId, input: { status: value } })
      }, statusValues)}
      className="border-none bg-transparent px-0 py-0 font-mono text-xs text-foreground outline-none"
    >
      {statusValues.map((value) => (
        <option key={value} value={value}>
          {statusLabels[value]}
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
      className="w-full border border-border bg-transparent px-2 py-1 font-mono text-xs outline-none focus:border-primary/50"
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
            'size-5 shrink-0 transition-all',
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
