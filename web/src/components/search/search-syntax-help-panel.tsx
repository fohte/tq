import type { SearchSyntaxHelpSection } from '#components/search/search-syntax-help-data'
import { Button } from '#components/ui/button'
import { cn } from '#lib/utils'

interface SearchSyntaxHelpPanelProps {
  sections: SearchSyntaxHelpSection[]
  onBack?: () => void
  className?: string
}

export function SearchSyntaxHelpPanel({
  sections,
  onBack,
  className,
}: SearchSyntaxHelpPanelProps) {
  return (
    <div
      className={cn(
        'max-h-96 overflow-y-auto px-4 py-3 font-mono text-xs',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-2xs font-medium uppercase tracking-widest text-muted-foreground-faint">
          Search syntax
        </h2>
        {onBack != null && (
          <Button variant="ghost" size="xs" onClick={onBack}>
            Back to search
          </Button>
        )}
      </div>
      {sections.map((section) => (
        <section key={section.title} className="mb-4 last:mb-0">
          <h3 className="mb-1 text-2xs uppercase tracking-widest text-muted-foreground">
            {section.title}
          </h3>
          <dl>
            {section.entries.map((entry) => (
              <div
                key={entry.syntax}
                className="flex gap-3 border-t border-border/60 py-2 first:border-t-0"
              >
                <dt className="w-40 shrink-0 whitespace-nowrap text-primary">
                  {entry.syntax}
                </dt>
                <dd className="min-w-0 flex-1 text-muted-foreground">
                  {entry.label != null && (
                    <span className="mr-2 text-foreground">{entry.label}</span>
                  )}
                  <span>{entry.description}</span>
                  {entry.values.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
                      {entry.values.map((value) => (
                        <span key={value.syntax} className="whitespace-nowrap">
                          <code className="text-foreground">
                            {value.syntax}
                          </code>{' '}
                          <span className="text-muted-foreground-faint">
                            {value.display}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
