import type { CSSProperties } from 'react'

export interface ChecklistIndentStyle extends CSSProperties {
  '--checklist-indent': string
}

export function getChecklistIndentStyle(indent: number): ChecklistIndentStyle {
  return { '--checklist-indent': `${String(indent)}px` }
}
