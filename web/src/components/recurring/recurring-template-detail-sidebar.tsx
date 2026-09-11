import { TemplateRepeatField } from '#components/recurring/template-repeat-field'
import { DetailSidebarPanel } from '#components/ui/detail-sidebar-panel'
import { useProject } from '#hooks/use-projects'
import type { RecurringTemplate } from '#hooks/use-recurring-templates'
import { useUpdateRecurringTemplate } from '#hooks/use-recurring-templates'
import { selectHandler } from '#lib/form-utils'
import { formatMinutes } from '#lib/format'
import { computeNextOccurrence } from '#lib/recurrence'
import { formatShortDate } from '#lib/task-due-date'

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
          <StateSelect templateId={template.id} enabled={template.enabled} />
        </TemplateFieldRow>
      </div>
    </div>
  )
}

// --- Computed Field Values ---

function nextValueLabel(template: RecurringTemplate): string {
  if (!template.enabled) return 'Not generating'
  const next = computeNextOccurrence(
    template.lastGeneratedDate ?? template.anchorDate,
    template.recurrenceRule,
  )
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
}: {
  templateId: string
  enabled: boolean
}) {
  const updateTemplate = useUpdateRecurringTemplate()
  const stateValues = ['active', 'paused'] as const

  return (
    <select
      value={enabled ? 'active' : 'paused'}
      onChange={selectHandler((value: (typeof stateValues)[number]) => {
        updateTemplate.mutate({
          id: templateId,
          input: { enabled: value === 'active' },
        })
      }, stateValues)}
      className="border-none bg-transparent px-0 py-0 font-mono text-xs text-foreground outline-none"
    >
      <option value="active">Active</option>
      <option value="paused">Paused</option>
    </select>
  )
}
