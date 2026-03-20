import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame-dark.css'
import '@web/components/ui/markdown-editor.css'

import { Crepe } from '@milkdown/crepe'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
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
