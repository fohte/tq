import { MarkdownEditor } from '#components/ui/markdown-editor'
import { useMemoDraft } from '#hooks/use-memo-draft'
import type { Memo, MemoContext, SaveMemoInput } from '#hooks/use-memos'
import { hasTqDesktopWindowControls } from '#lib/is-tq-desktop'
import { cn } from '#lib/utils'

export interface MemoWindowProps {
  context: MemoContext
  memo: Memo | undefined
  isLoading?: boolean
  loadError?: boolean
  desktopWindowControls?: boolean
  onSave: (input: SaveMemoInput) => Promise<Memo>
}

export function MemoWindow({
  context,
  memo,
  isLoading = false,
  loadError = false,
  desktopWindowControls = hasTqDesktopWindowControls(),
  onSave,
}: MemoWindowProps) {
  const { draft, editorKey, handleChange, status } = useMemoDraft({
    memo,
    onSave,
    isLoading,
    loadError,
  })
  const title = context === 'work' ? 'Work memo' : 'Personal memo'

  return (
    <section className="flex h-full min-h-0 flex-col bg-background px-3 pb-3 pt-2">
      <header
        className={cn(
          'shrink-0 justify-between gap-2',
          desktopWindowControls
            ? 'electron-titlebar-bar -mx-3 -mt-2 pr-3'
            : 'flex h-8 items-center',
        )}
      >
        <h1 className="text-sm font-medium text-foreground">{title}</h1>
        <span
          aria-live="polite"
          className={cn(
            'text-2xs text-muted-foreground',
            desktopWindowControls && 'electron-no-drag-region',
          )}
        >
          {status}
        </span>
      </header>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-md border border-border bg-card">
        {isLoading || loadError ? (
          <div
            className="flex h-full items-center px-3 text-sm text-muted-foreground"
            role="status"
          >
            {isLoading ? 'Loading memo…' : 'Memo unavailable'}
          </div>
        ) : (
          <div aria-label={title} className="h-full" role="group">
            <MarkdownEditor
              key={editorKey}
              defaultValue={draft}
              focusAtEnd
              onChange={handleChange}
              placeholder="Add a note..."
              size="default"
            />
          </div>
        )}
      </div>
    </section>
  )
}
