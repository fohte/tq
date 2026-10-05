import { SegmentedControl } from '@fohte/ui/segmented-control'
import { useState } from 'react'

import { HtmlPageViewer } from '#components/ui/html-page-viewer'
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
  /**
   * 'default' is a fixed 400px height, for a standalone editor with no
   * sized ancestor. 'fill' bakes in `h-full`, stretching to match a flex
   * ancestor that already has a defined height (e.g. a full-page layout).
   */
  size?: 'default' | 'fill'
}

export function HtmlPageEditor({
  defaultValue = '',
  onChange,
  placeholder,
  className,
  onExitSourceMode,
  size = 'default',
}: HtmlPageEditorProps) {
  const [mode, setMode] = useState<HtmlEditorMode>('preview')
  const [value, setValue] = useState(defaultValue)

  return (
    <div
      data-slot="html-page-editor"
      className={cn(
        'flex flex-col gap-2',
        size === 'fill' ? 'h-full' : 'h-100',
        className,
      )}
    >
      <div className="self-end shrink-0">
        <SegmentedControl
          value={mode}
          options={[
            { value: 'preview', label: 'Preview' },
            { value: 'source', label: 'Source' },
          ]}
          onValueChange={(next) => {
            if (mode === 'source' && next === 'preview') onExitSourceMode?.()
            setMode(next)
          }}
        />
      </div>
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
        <HtmlPageViewer content={value} size="fill" />
      )}
    </div>
  )
}
