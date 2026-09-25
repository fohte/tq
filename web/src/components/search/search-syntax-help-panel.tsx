import {
  ArrowDownWideNarrow,
  BriefcaseBusiness,
  CircleDot,
  FileText,
  FolderKanban,
  ListTree,
  type LucideIcon,
  Tag,
} from 'lucide-react'
import type { RefObject } from 'react'

import type { SearchSyntaxHelpSection } from '#components/search/search-syntax-help-data'
import { Button } from '#components/ui/button'
import { cn } from '#lib/utils'

interface SearchSyntaxHelpPanelProps {
  sections: SearchSyntaxHelpSection[]
  onBack?: () => void
  className?: string
  backButtonRef?: RefObject<HTMLButtonElement | null>
  showFilterIcons?: boolean
}

const filterSyntaxIcons: Record<string, LucideIcon> = {
  is: CircleDot,
  context: BriefcaseBusiness,
  sort: ArrowDownWideNarrow,
  has: FileText,
  label: Tag,
  parent: ListTree,
  project: FolderKanban,
}

export function SearchSyntaxHelpPanel({
  sections,
  onBack,
  className,
  backButtonRef,
  showFilterIcons = false,
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
          <Button
            ref={backButtonRef}
            variant="ghost"
            size="xs"
            onClick={onBack}
          >
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
              <HelpEntry
                key={entry.syntax}
                entry={entry}
                showFilterIcons={showFilterIcons}
              />
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}

function HelpEntry({
  entry,
  showFilterIcons,
}: {
  entry: SearchSyntaxHelpSection['entries'][number]
  showFilterIcons: boolean
}) {
  const Icon = showFilterIcons
    ? filterSyntaxIcons[entry.syntax.split(':', 1)[0] ?? '']
    : undefined

  return (
    <div className="flex flex-col gap-1 border-t border-border/60 py-2 first:border-t-0 md:flex-row md:gap-3">
      <dt className="flex min-w-0 break-all text-primary md:w-40 md:shrink-0">
        {Icon != null && (
          <Icon
            className="mr-2 mt-0.5 size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        )}
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
              <span key={value.syntax}>
                <code className="break-all text-foreground">
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
  )
}
