import type { MouseEvent } from 'react'

// A reference card's whole clickable area also contains selectable title/
// excerpt text (see markdown-editor.css's .inline-reference-card comment).
// Browsers still fire `click` after a mouseup that ends a drag-selection
// inside the same element regardless of whether a selection was made, so
// without this, dragging to select and copy the card's text would also
// navigate away.
export function preventClickWhileSelecting(event: MouseEvent) {
  if (window.getSelection()?.toString() !== '') {
    event.preventDefault()
  }
}
