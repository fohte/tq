import { TabStrip } from '#components/ui/tab-strip'
import type { DescriptionTemplate } from '#hooks/use-description-templates'

export function CreateTaskModalDescriptionTemplateSelector({
  templates,
  selectedTemplateName,
  onChange,
}: {
  templates: DescriptionTemplate[]
  selectedTemplateName: string | null
  onChange: (templateName: string | null) => void
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-1"
      data-description-template-field
    >
      <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
        TEMPLATE
      </span>
      <TabStrip
        value={selectedTemplateName ?? ''}
        options={[
          { value: '', label: '—' },
          ...templates.map((template) => ({
            value: template.name,
            label: template.name,
          })),
        ]}
        onChange={(templateName) => {
          onChange(templateName || null)
        }}
        tabIndex={-1}
        className="max-w-full overflow-x-auto"
      />
    </div>
  )
}
