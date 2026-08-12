import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame-dark.css'
import '#components/ui/markdown-editor.css'

import { Crepe } from '@milkdown/crepe'
import { upload, uploadConfig } from '@milkdown/plugin-upload'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import {
  ProsemirrorAdapterProvider,
  useWidgetViewFactory,
} from '@prosemirror-adapter/react'
import { useEffect, useRef, useState } from 'react'

import {
  handleImageLoadError,
  resolveImageSrc,
  uploadImageFile,
  uploadImageFiles,
} from '#lib/image-upload'
import { createInlineReferencePlugin } from '#lib/inline-reference/plugin'
import { githubUrlProvider } from '#lib/inline-reference/providers/github-url'
import { slackPermalinkProvider } from '#lib/inline-reference/providers/slack-permalink'
import { taskMentionProvider } from '#lib/inline-reference/providers/task-mention'
import { taskMentionAutocompletePlugin } from '#lib/inline-reference/providers/task-mention-autocomplete-plugin'
import { createInlineReferenceViewModeStore } from '#lib/inline-reference/view-mode'
import { cn } from '#lib/utils'

export interface ViewEditToggleOptions {
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
   * raw Markdown source and the cursor at the click position; losing focus
   * or pressing Escape returns to the read-only view. Omit for an
   * always-editable editor that always shows the raw Markdown source and
   * never renders chips (e.g. new-entry composers like CommentInput or
   * create-task-modal).
   */
  viewEditToggle?: ViewEditToggleOptions
  /**
   * Default min-height: 'default' (400px) for a primary/full editing
   * surface, 'compact' (120px) for a few-lines inline editor. Callers no
   * longer need to wrap the editor in a min-height div.
   */
  size?: 'default' | 'compact'
}

interface CrepeEditorProps {
  defaultValue?: string
  onChange?: (markdown: string) => void
  placeholder?: string
  // Also controls Crepe's readOnly (view => readOnly, edit => editable): the
  // two always move together, since an editable+chip combination would let
  // mid-edit typing form a chip out from under the cursor.
  mode: 'view' | 'edit'
}

function CrepeEditor({
  defaultValue,
  onChange,
  placeholder,
  mode,
}: CrepeEditorProps) {
  const crepeRef = useRef<Crepe | null>(null)
  const viewModeStoreRef = useRef<ReturnType<
    typeof createInlineReferenceViewModeStore
  > | null>(null)
  const widgetViewFactory = useWidgetViewFactory()

  useEditor((root) => {
    const crepe = new Crepe({
      root,
      defaultValue: defaultValue ?? '',
      ...(placeholder != null ? { placeholder } : {}),
      featureConfigs: {
        [Crepe.Feature.ImageBlock]: {
          onUpload: uploadImageFile,
          proxyDomURL: resolveImageSrc,
          onImageLoadError: handleImageLoadError,
        },
      },
    })

    // Initial mode only: unlike the props above, this never re-runs on
    // rerender (useEditor memoizes this callback once), so later changes are
    // instead applied via the effect below.
    crepe.setReadonly(mode === 'view')
    const viewModeStore = createInlineReferenceViewModeStore(mode)

    // Crepe's image-block feature only covers file-picker uploads; wire up
    // plugin-upload so pasting/dropping an image anywhere in the editor
    // uploads it too.
    crepe.editor
      .use(upload)
      .config((ctx) => {
        ctx.update(uploadConfig.key, (prev) => ({
          ...prev,
          uploader: (files, schema) =>
            uploadImageFiles(files, (src, alt) =>
              schema.nodes['image']?.createAndFill({ src, alt }),
            ),
        }))
      })
      .use(
        createInlineReferencePlugin(
          taskMentionProvider,
          widgetViewFactory,
          viewModeStore,
        ),
      )
      .use(taskMentionAutocompletePlugin)
      .use(
        createInlineReferencePlugin(
          githubUrlProvider,
          widgetViewFactory,
          viewModeStore,
        ),
      )
      .use(
        createInlineReferencePlugin(
          slackPermalinkProvider,
          widgetViewFactory,
          viewModeStore,
        ),
      )

    if (onChange) {
      crepe.on((listener) => {
        listener.markdownUpdated((_ctx, markdown) => {
          onChange(markdown)
        })
      })
    }

    crepeRef.current = crepe
    viewModeStoreRef.current = viewModeStore
    return crepe
  })

  // Follows `mode` after the initial render: the Crepe instance itself is
  // only ever created once (see the initial-mode comment above), so later
  // changes have to be pushed onto it imperatively.
  //
  // This deliberately never dispatches a ProseMirror transaction. Any
  // dispatched transaction — even one that changes no document content —
  // gives every plugin's `appendTransaction` hook a chance to run, and
  // Milkdown's built-in `trailing` plugin (@milkdown/plugin-trailing) uses
  // that hook to insert an empty paragraph whenever the document doesn't
  // already end in one, independent of what triggered the transaction. That
  // turned "click into edit mode" / "click out again" into a real,
  // content-changing edit with zero typing. `crepe.setReadonly()` already
  // calls `view.setProps()` below, which alone is enough to make
  // ProseMirror recompute decorations against the store's new value (see
  // view-mode.ts).
  useEffect(() => {
    viewModeStoreRef.current?.setMode(mode)
    crepeRef.current?.setReadonly(mode === 'view')
  }, [mode])

  return <Milkdown />
}

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
    <MilkdownProvider>
      <ProsemirrorAdapterProvider>
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
          <CrepeEditor
            {...editorProps}
            mode={isToggleEnabled ? mode : 'edit'}
          />
        </div>
      </ProsemirrorAdapterProvider>
    </MilkdownProvider>
  )
}
