import { lazy, Suspense, useRef } from 'react'

import { cn } from '#lib/utils'

interface MarkdownEditorCommonProps {
  defaultValue?: string
  onChange?: (markdown: string) => void
  /** Reports the focused editor after a document change so callers can read its current Markdown. */
  onFocusedDocumentChange?: (readMarkdown: () => string) => void
  placeholder?: string
  /**
   * Default min-height: 'default' (400px) for a primary/full editing
   * surface, 'compact' (120px) for a few-lines inline editor, 'fit' for no
   * minimum (read-only content sized to its text).
   */
  size?: 'default' | 'compact' | 'fit'
}

// Milkdown copies Markdown link destinations directly to `href` without
// filtering them, so executable schemes must stay inert in read-only mode.
const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

type MarkdownEditorProps = MarkdownEditorCommonProps &
  (
    | {
        /** Controls whether the editor is in edit mode. */
        editing: boolean
        /** Reports a request to leave edit mode; the caller updates `editing`. */
        onEditingChange: (editing: boolean) => void
        /** Called before leaving edit mode (blur or Escape), e.g. to flush autosave. */
        onExitEditMode?: () => void
      }
    | {
        /** Editors that are always editable do not support an editing toggle. */
        editing?: never
        onEditingChange?: never
        onExitEditMode?: never
      }
  )

// Loaded on demand: pulls in milkdown/ProseMirror/micromark, which are only
// needed on routes that actually render an editor.
const CrepeEditorRoot = lazy(() =>
  import('#components/ui/markdown-editor-crepe').catch((error: unknown) => {
    console.error('Failed to load markdown editor', error)
    // eslint-disable-next-line no-restricted-syntax -- React.lazy's loader is a throwing contract: it must reject/throw to signal a failed dynamic import
    throw error
  }),
)

function isEventTargetInsideEditorUi(
  wrapper: HTMLElement,
  target: EventTarget | null,
): boolean {
  if (!(target instanceof Node)) return false
  if (wrapper.contains(target)) return true
  // Only tq's own task-mention-autocomplete renders outside
  // `.milkdown-wrapper` (portalled to document.body via `position: fixed`;
  // see markdown-editor.css). Crepe's own toolbar/slash-menu/block-handle/
  // link-tooltip popovers append inside `view.dom.parentElement` by default,
  // so they're already covered by the `wrapper.contains(target)` check
  // above.
  return (
    target instanceof Element &&
    target.closest('.task-mention-autocomplete') != null
  )
}

export function MarkdownEditor({
  editing,
  onEditingChange,
  onExitEditMode,
  size = 'default',
  ...editorProps
}: MarkdownEditorProps) {
  const isControlled = editing !== undefined
  const mode = isControlled ? (editing ? 'edit' : 'view') : 'edit'
  const wrapperRef = useRef<HTMLDivElement>(null)

  const exitEditMode = () => {
    if (mode !== 'edit' || editing === undefined) return
    onExitEditMode?.()
    onEditingChange(false)
  }

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'milkdown-wrapper',
        size === 'compact' && 'min-h-30',
        size === 'default' && 'min-h-100',
      )}
      data-view-mode={isControlled ? mode : undefined}
      onClickCapture={
        mode === 'view'
          ? (event) => {
              const link =
                event.target instanceof Element
                  ? event.target.closest('a')
                  : null
              if (link != null && !SAFE_LINK_PROTOCOLS.has(link.protocol))
                event.preventDefault()
            }
          : undefined
      }
      onBlur={
        isControlled
          ? (event) => {
              if (
                wrapperRef.current != null &&
                isEventTargetInsideEditorUi(
                  wrapperRef.current,
                  event.relatedTarget,
                )
              )
                return
              exitEditMode()
            }
          : undefined
      }
      onKeyDown={
        isControlled
          ? (event) => {
              if (event.key === 'Escape') exitEditMode()
            }
          : undefined
      }
    >
      <Suspense fallback={null}>
        <CrepeEditorRoot
          {...editorProps}
          mode={mode}
          focusOnEdit={isControlled}
          skipNoopChanges={isControlled}
        />
      </Suspense>
    </div>
  )
}
