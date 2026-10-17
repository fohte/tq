import type { CSSProperties } from 'react'

export interface ChecklistIndentStyle extends CSSProperties {
  '--checklist-indent': string
}

export function getChecklistIndent(indent: number): string {
  return `${String(indent)}px`
}
