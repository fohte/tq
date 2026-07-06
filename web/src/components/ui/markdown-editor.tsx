import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame-dark.css'
import '@web/components/ui/markdown-editor.css'

import { Crepe } from '@milkdown/crepe'
import { upload, uploadConfig } from '@milkdown/plugin-upload'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import {
  handleImageLoadError,
  resolveImageSrc,
  uploadImageFile,
} from '@web/lib/image-upload'
import { useRef } from 'react'

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
    crepe.editor.use(upload).config((ctx) => {
      ctx.update(uploadConfig.key, (prev) => ({
        ...prev,
        uploader: async (files, schema) => {
          const nodes = []
          for (const file of Array.from(files)) {
            try {
              const src = await uploadImageFile(file)
              const node = schema.nodes['image']?.createAndFill({
                src,
                alt: file.name,
              })
              if (node) nodes.push(node)
            } catch (error) {
              console.error('Failed to upload pasted/dropped image', error)
            }
          }
          return nodes
        },
      }))
    })

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
      <div className="milkdown-wrapper">
        <CrepeEditor {...props} />
      </div>
    </MilkdownProvider>
  )
}
