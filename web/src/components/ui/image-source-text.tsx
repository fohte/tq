import { useEffect, useRef } from 'react'

export interface ImageSourceTextProps {
  initialText: string
  editable: boolean
  onCommit: (text: string) => void
  onCommitAndMoveOut: (text: string) => void
}

// Renders the raw `![alt](src "title")` source as an editable overlay while
// the image behind it is hidden by the `image-source-active` node decoration
// (see markdown-editor.css and lib/image-source-reveal/plugin.tsx). Kept
// intentionally separate from ProseMirror's own text/selection model: this
// is a small contenteditable scratchpad whose content is only ever
// committed back on blur/Escape/Enter, not a live-typed part of the
// document.
export function ImageSourceText({
  initialText,
  editable,
  onCommit,
  onCommitAndMoveOut,
}: ImageSourceTextProps) {
  const ref = useRef<HTMLSpanElement>(null)

  // Mount-only: further changes to the text come from this component's own
  // onCommit/onCommitAndMoveOut calls, which already reflect the edited
  // text on screen.
  useEffect(() => {
    if (ref.current == null) return
    ref.current.textContent = initialText
    ref.current.focus()
  }, [])

  return (
    <span
      ref={ref}
      contentEditable={editable}
      suppressContentEditableWarning
      className="image-source-text"
      onBlur={() => {
        onCommit(ref.current?.textContent ?? '')
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' || event.key === 'Enter') {
          event.preventDefault()
          onCommitAndMoveOut(ref.current?.textContent ?? '')
        }
      }}
    />
  )
}
