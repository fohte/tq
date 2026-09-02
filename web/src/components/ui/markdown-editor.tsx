import { lazy, Suspense, useRef, useState } from 'react'

import { cn } from '#lib/utils'

interface ViewEditToggleOptions {
  /**
   * Mode the editor starts in. Defaults to 'view'; pass 'edit' for a route
   * where editing is the primary action (e.g. a dedicated page editor).
   */
  defaultMode?: 'view' | 'edit'
  /** Called right before the editor returns to view mode (blur or Escape); hook up a debounced save's `flush` here. */
  onExitEditMode?: () => void
}

interface MarkdownEditorProps {
  defaultValue?: string
  onChange?: (markdown: string) => void
  placeholder?: string
  /**
   * Enables the view/edit toggle: the editor starts read-only and shows
   * inline reference chips; clicking switches to an editable view with the
   * raw Markdown source and the cursor at the click position, except for a
   * rendered link or an inline-reference chip/card, which navigates or
   * interacts with it instead of switching modes; losing focus or pressing
   * Escape returns to the read-only view. Omit for an
   * always-editable editor that always shows the raw Markdown source and
   * never renders chips (e.g. new-entry composers like CommentInput or
   * create-task-modal).
   */
  viewEditToggle?: ViewEditToggleOptions
  /**
   * Default min-height: 'default' (400px) for a primary/full editing
   * surface, 'compact' (120px) for a few-lines inline editor.
   */
  size?: 'default' | 'compact'
}

// Schemes a rendered Markdown link may click through to in view mode without
// first entering edit mode. Excludes `javascript:` and other executable
// schemes, since Milkdown's link mark copies the raw Markdown href onto the
// <a> with no filtering.
const NAVIGABLE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

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
  viewEditToggle,
  size = 'default',
  ...editorProps
}: MarkdownEditorProps) {
  const isToggleEnabled = viewEditToggle != null
  const [mode, setMode] = useState<'view' | 'edit'>(
    viewEditToggle?.defaultMode ?? 'view',
  )
  const wrapperRef = useRef<HTMLDivElement>(null)

  const exitEditMode = () => {
    if (mode !== 'edit') return
    viewEditToggle?.onExitEditMode?.()
    setMode('view')
  }

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'milkdown-wrapper',
        size === 'compact' ? 'min-h-30' : 'min-h-100',
      )}
      data-view-mode={isToggleEnabled ? mode : undefined}
      onMouseUp={
        isToggleEnabled && mode === 'view'
          ? (event) => {
              // Left click only: a right/middle click opening a context
              // menu or auto-scroll shouldn't also switch to edit mode.
              if (event.button !== 0) return
              // A rendered Markdown link should navigate, not switch to
              // edit mode: readonly must stay true past this handler so the
              // click event that follows still hits a non-editable <a> (a
              // contenteditable one loses the browser's default
              // click-through). See plugin.tsx's createCardWidgetComponent
              // for the same guard on inline-reference cards. Restricted to
              // navigable schemes: Milkdown's link mark puts the raw
              // Markdown href on the <a> unfiltered, so a `javascript:` link
              // must still fall through to edit mode (never execute) rather
              // than becoming clickable.
              const link =
                event.target instanceof Element
                  ? event.target.closest('a')
                  : null
              if (link != null && NAVIGABLE_LINK_PROTOCOLS.has(link.protocol))
                return
              setMode('edit')
            }
          : undefined
      }
      onBlur={
        isToggleEnabled
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
        isToggleEnabled
          ? (event) => {
              if (event.key === 'Escape') exitEditMode()
            }
          : undefined
      }
    >
      <Suspense fallback={null}>
        <CrepeEditorRoot
          {...editorProps}
          mode={isToggleEnabled ? mode : 'edit'}
        />
      </Suspense>
    </div>
  )
}
