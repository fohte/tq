import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@fohte/ui/select'

import { TemplateRepeatField } from '#components/recurring/template-repeat-field'
import { DetailSidebarPanel } from '#components/ui/detail-sidebar-panel'
import { useProject } from '#hooks/use-projects'
import type { RecurringTemplate } from '#hooks/use-recurring-templates'
import { useUpdateRecurringTemplate } from '#hooks/use-recurring-templates'
import { selectValueHandler } from '#lib/form-utils'
import { formatMinutes } from '#lib/format'
import { templateNextOccurrence } from '#lib/recurrence'
import { formatShortDate } from '#lib/task-due-date'
import { cn } from '#lib/utils'

// --- Sidebar (PC) ---

export function RecurringTemplateSidebar({
  template,
}: {
  template: RecurringTemplate
}) {
  return (
    <DetailSidebarPanel>
      <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
        TEMPLATE
      </span>
      <TemplateRepeatField
        templateId={template.id}
        recurrenceRule={template.recurrenceRule}
        lastGeneratedDate={template.lastGeneratedDate}
        anchorDate={template.anchorDate}
      />
      <TemplateSidebarField label="NEXT">
        {nextValueLabel(template)}
      </TemplateSidebarField>
      <TemplateSidebarField label="DUE OFFSET">
        {dueOffsetLabel(template.startOffsetDays)}
      </TemplateSidebarField>
      <TemplateSidebarField label="ESTIMATE">
        {template.estimatedMinutes != null
          ? formatMinutes(template.estimatedMinutes)
          : '—'}
      </TemplateSidebarField>
      <TemplateSidebarField label="CONTEXT">
        {template.context}
      </TemplateSidebarField>
      <TemplateSidebarField label="PROJECT">
        <ProjectValue projectId={template.projectId} />
      </TemplateSidebarField>
      <TemplateSidebarField label="TAGS">
        {template.labels.length > 0 ? template.labels.join(', ') : '—'}
      </TemplateSidebarField>
      <TemplateSidebarField label="STATE">
        <StateSelect templateId={template.id} enabled={template.enabled} />
      </TemplateSidebarField>
    </DetailSidebarPanel>
  )
}

// --- Sidebar (SP) ---

export function RecurringTemplateSidebarMobile({
  template,
}: {
  template: RecurringTemplate
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
        TEMPLATE
      </span>
      <TemplateRepeatField
        templateId={template.id}
        recurrenceRule={template.recurrenceRule}
        lastGeneratedDate={template.lastGeneratedDate}
        anchorDate={template.anchorDate}
      />
      <div className="flex flex-col gap-2">
        <TemplateFieldRow label="NEXT">
          {nextValueLabel(template)}
        </TemplateFieldRow>
        <TemplateFieldRow label="DUE OFFSET">
          {dueOffsetLabel(template.startOffsetDays)}
        </TemplateFieldRow>
        <TemplateFieldRow label="ESTIMATE">
          {template.estimatedMinutes != null
            ? formatMinutes(template.estimatedMinutes)
            : '—'}
        </TemplateFieldRow>
        <TemplateFieldRow label="CONTEXT">{template.context}</TemplateFieldRow>
        <TemplateFieldRow label="PROJECT">
          <ProjectValue projectId={template.projectId} />
        </TemplateFieldRow>
        <TemplateFieldRow label="TAGS">
          {template.labels.length > 0 ? template.labels.join(', ') : '—'}
        </TemplateFieldRow>
        <TemplateFieldRow label="STATE">
          <StateSelect
            templateId={template.id}
            enabled={template.enabled}
            mobileLayout
          />
        </TemplateFieldRow>
      </div>
    </div>
  )
}

// --- Computed Field Values ---

function nextValueLabel(template: RecurringTemplate): string {
  if (!template.enabled) return 'Not generating'
  const next = templateNextOccurrence(template)
  return next != null ? formatShortDate(next) : '—'
}

function dueOffsetLabel(startOffsetDays: number | null): string {
  if (startOffsetDays == null) return '—'
  return `${String(startOffsetDays)} day${startOffsetDays === 1 ? '' : 's'} after start`
}

// --- Sidebar Fields ---

function TemplateSidebarField({
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

function TemplateFieldRow({
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

function ProjectValue({ projectId }: { projectId: string | null }) {
  if (projectId == null) return <>—</>
  return <ProjectTitle projectId={projectId} />
}

function ProjectTitle({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId)
  return <>{project?.title ?? '—'}</>
}

function StateSelect({
  templateId,
  enabled,
  mobileLayout = false,
}: {
  templateId: string
  enabled: boolean
  mobileLayout?: boolean
}) {
  const updateTemplate = useUpdateRecurringTemplate()
  const stateValues = ['active', 'paused'] as const

  return (
    <Select
      items={stateValues.map((value) => ({
        value,
        label: value === 'active' ? 'Active' : 'Paused',
      }))}
      value={enabled ? 'active' : 'paused'}
      onValueChange={selectValueHandler(
        (value: (typeof stateValues)[number]) => {
          updateTemplate.mutate({
            id: templateId,
            input: { enabled: value === 'active' },
          })
        },
        stateValues,
      )}
    >
      <SelectTrigger
        size="sm"
        iconClassName="size-4 -translate-x-0.5 text-foreground native-select-caret-stroke"
        className={cn(
          'h-auto data-[size=sm]:h-auto w-fit min-w-0 gap-0.5 border-0 bg-transparent dark:bg-transparent hover:bg-transparent dark:hover:bg-transparent p-0 pl-1 py-px font-mono text-xs text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0',
          mobileLayout && 'min-h-5 translate-y-px',
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="active">Active</SelectItem>
        <SelectItem value="paused">Paused</SelectItem>
      </SelectContent>
    </Select>
  )
}
