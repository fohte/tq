import { useState } from 'react'

import { HtmlPageViewer } from '#components/ui/html-page-viewer'
import { SegmentedControl } from '#components/ui/segmented-control'
import { Textarea } from '#components/ui/textarea'
import { cn } from '#lib/utils'

type HtmlEditorMode = 'preview' | 'source'

export interface HtmlPageEditorProps {
  defaultValue?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  /** Called right before switching from source back to preview; hook up a debounced save's `flush` here. */
  onExitSourceMode?: () => void
}

// HTML pages can't reuse MarkdownEditor's click-to-edit view/edit toggle:
// clicks inside the sandboxed iframe (a separate document) never bubble to
// this component, so switching modes needs an explicit control instead.
export function HtmlPageEditor({
  defaultValue = '',
  onChange,
  placeholder,
  className,
  onExitSourceMode,
}: HtmlPageEditorProps) {
  const [mode, setMode] = useState<HtmlEditorMode>('preview')
  const [value, setValue] = useState(defaultValue)

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <SegmentedControl
        value={mode}
        options={[
          { value: 'preview', label: 'Preview' },
          { value: 'source', label: 'Source' },
        ]}
        onChange={(next) => {
          if (mode === 'source' && next === 'preview') onExitSourceMode?.()
          setMode(next)
        }}
        containerClassName="self-end shrink-0 rounded-md bg-secondary p-0.5"
        activeClassName="bg-background text-foreground shadow-sm"
        inactiveClassName="text-muted-foreground hover:text-foreground"
      />
      {mode === 'source' ? (
        <Textarea
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            setValue(e.target.value)
            onChange?.(e.target.value)
          }}
          className="min-h-0 flex-1 resize-none font-mono"
        />
      ) : (
        <HtmlPageViewer content={value} className="min-h-0 flex-1" />
      )}
    </div>
  )
}
