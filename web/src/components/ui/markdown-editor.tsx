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
import { useRef } from 'react'

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

interface MarkdownEditorProps {
  defaultValue?: string
  onChange?: (markdown: string) => void
  placeholder?: string
}

function CrepeEditor({
  defaultValue,
  onChange,
  placeholder,
}: MarkdownEditorProps) {
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

  return <Milkdown />
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  return (
    <MilkdownProvider>
      <ProsemirrorAdapterProvider>
        <div className="milkdown-wrapper">
          <CrepeEditor {...props} />
        </div>
      </ProsemirrorAdapterProvider>
    </MilkdownProvider>
  )
}
