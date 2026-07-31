import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame-dark.css'
import '#components/ui/markdown-editor.css'

import { Crepe } from '@milkdown/crepe'
import { EditorStatus, editorViewCtx } from '@milkdown/kit/core'
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
import { taskMentionProvider } from '#lib/inline-reference/providers/task-mention'
import { taskMentionAutocompletePlugin } from '#lib/inline-reference/providers/task-mention-autocomplete-plugin'
import {
  createInlineReferenceViewModePlugin,
  dispatchInlineReferenceViewMode,
} from '#lib/inline-reference/view-mode'

export interface ViewEditToggleOptions {
  /** Mode the editor starts in. Defaults to 'view'. */
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
}

interface CrepeEditorProps {
  defaultValue?: string
  onChange?: (markdown: string) => void
  placeholder?: string
  // Also controls Crepe's readOnly (view => readOnly, edit => editable): the
  // two always move together, since an editable+chip combination would let
  // mid-edit typing form a chip out from under the cursor (this is what
  // selection-overlap.ts used to prevent by suppressing decorations wherever
  // the selection touched a match; removed now that decorations never render
  // in 'edit' mode at all).
  mode: 'view' | 'edit'
}

function CrepeEditor({
  defaultValue,
  onChange,
  placeholder,
  mode,
}: CrepeEditorProps) {
  const crepeRef = useRef<Crepe | null>(null)
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
      .use(createInlineReferenceViewModePlugin(mode))
      .use(createInlineReferencePlugin(taskMentionProvider, widgetViewFactory))
      .use(taskMentionAutocompletePlugin)
      .use(createInlineReferencePlugin(githubUrlProvider, widgetViewFactory))

    if (onChange) {
      crepe.on((listener) => {
        listener.markdownUpdated((_ctx, markdown) => {
          onChange(markdown)
        })
      })
    }

    crepeRef.current = crepe
    return crepe
  })

  // Follows `mode` after the initial render: the Crepe instance itself is
  // only ever created once (see the initial-mode comment above), so later
  // changes have to be pushed onto it imperatively.
  useEffect(() => {
    const crepe = crepeRef.current
    if (crepe == null) return
    crepe.setReadonly(mode === 'view')
    if (crepe.editor.status !== EditorStatus.Created) return
    crepe.editor.action((ctx) => {
      dispatchInlineReferenceViewMode(ctx.get(editorViewCtx), mode)
    })
  }, [mode])

  return <Milkdown />
}

function isEventTargetInsideEditorUi(
  wrapper: HTMLElement,
  target: EventTarget | null,
): boolean {
  if (!(target instanceof Node)) return false
  if (wrapper.contains(target)) return true
  // Crepe's toolbar/slash-menu/block-handle/link-preview/link-edit popovers
  // and tq's own task-mention-autocomplete render outside `.milkdown-wrapper`
  // (portalled to document.body), so focus moving into them must not be
  // treated as focus leaving the editor.
  return (
    target instanceof Element &&
    target.closest('.task-mention-autocomplete') != null
  )
}

export function MarkdownEditor({
  viewEditToggle,
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
          className="milkdown-wrapper"
          data-view-mode={isToggleEnabled ? mode : undefined}
          onMouseUp={
            isToggleEnabled && mode === 'view'
              ? () => {
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
