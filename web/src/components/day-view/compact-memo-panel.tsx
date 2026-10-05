import '#components/day-view/compact-memo-panel.css'

import { ArrowUpRight } from 'lucide-react'

import { MarkdownEditor } from '#components/ui/markdown-editor'
import { useMemoDraft } from '#hooks/use-memo-draft'
import type { Memo, MemoContext, SaveMemoInput } from '#hooks/use-memos'
import { openMemoWindow } from '#lib/memo-window'

interface CompactMemoPanelProps {
  context: MemoContext
  memo: Memo | undefined
  isLoading?: boolean
  loadError?: boolean
  onSave: (input: SaveMemoInput) => Promise<Memo>
}

export function CompactMemoPanel({
  context,
  memo,
  isLoading = false,
  loadError = false,
  onSave,
}: CompactMemoPanelProps) {
  const { draft, editorKey, handleChange, status } = useMemoDraft({
    memo,
    onSave,
    isLoading,
    loadError,
  })
  const title = context === 'work' ? 'Work memo' : 'Personal memo'

  return (
    <section className="flex shrink-0 flex-col border-t border-border bg-background px-2 pb-2 pt-1">
      <div className="flex h-6 items-center justify-between gap-2">
        <h2 className="text-xs font-medium text-foreground">{title}</h2>
        <div className="flex items-center gap-2">
          <span aria-live="polite" className="text-2xs text-muted-foreground">
            {status}
          </span>
          <button
            aria-label="Open memo window"
            className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={openMemoWindow}
            title="Open memo window"
            type="button"
          >
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="h-18 shrink-0 overflow-y-auto rounded-md border border-border bg-card">
        {isLoading || loadError ? (
          <div
            className="flex h-full items-center px-2 text-xs text-muted-foreground"
            role="status"
          >
            {isLoading ? 'Loading memo…' : 'Memo unavailable'}
          </div>
        ) : (
          <div aria-label={title} className="compact-memo-editor" role="group">
            <MarkdownEditor
              key={editorKey}
              defaultValue={draft}
              onChange={handleChange}
              placeholder="Add a note..."
              size="fit"
            />
          </div>
        )}
      </div>
    </section>
  )
}
