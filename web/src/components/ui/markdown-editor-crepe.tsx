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
import { useEffect, useRef } from 'react'

import {
  handleImageLoadError,
  resolveImageSrc,
  uploadImageFile,
  uploadImageFiles,
} from '#lib/image-upload'
import { createInlineReferencePlugin } from '#lib/inline-reference/plugin'
import { githubUrlProvider } from '#lib/inline-reference/providers/github-url'
import { projectUrlProvider } from '#lib/inline-reference/providers/project-url'
import { slackPermalinkProvider } from '#lib/inline-reference/providers/slack-permalink'
import { taskMentionProvider } from '#lib/inline-reference/providers/task-mention'
import { taskMentionAutocompletePlugin } from '#lib/inline-reference/providers/task-mention-autocomplete-plugin'
import { taskUrlProvider } from '#lib/inline-reference/providers/task-url'
import { createInlineReferenceViewModeStore } from '#lib/inline-reference/view-mode'

export interface CrepeEditorProps {
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
          onUpload: (file) =>
            uploadImageFile(file).match(
              (src) => src,
              (error) => {
                throw error
              },
            ),
          proxyDomURL: (src) =>
            resolveImageSrc(src).match(
              (resolvedSrc) => resolvedSrc,
              (error) => {
                throw error
              },
            ),
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
          taskUrlProvider,
          widgetViewFactory,
          viewModeStore,
        ),
      )
      .use(
        createInlineReferencePlugin(
          projectUrlProvider,
          widgetViewFactory,
          viewModeStore,
        ),
      )
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

// Default export so `MarkdownEditor` (markdown-editor.tsx) can load this
// module — the milkdown/ProseMirror/micromark editor stack — via
// `React.lazy`, keeping it out of the entry chunk for routes that never
// show an editor.
export default function CrepeEditorRoot(props: CrepeEditorProps) {
  return (
    <MilkdownProvider>
      <ProsemirrorAdapterProvider>
        <CrepeEditor {...props} />
      </ProsemirrorAdapterProvider>
    </MilkdownProvider>
  )
}
