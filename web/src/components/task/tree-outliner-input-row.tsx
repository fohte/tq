import type { InheritedTaskAttributes } from '#components/task/create-task-inline'
import { CreateTaskInline } from '#components/task/create-task-inline'

// Tab/Shift-Tab aren't handled inside CreateTaskInline itself (it only
// preventDefaults Tab for its own suggestion/existing-task dropdowns), so an
// unhandled Tab bubbles up to this wrapper untouched.
export function TreeOutlinerInputRow({
  depth,
  parentId,
  parentNumber,
  inherited,
  onClose,
  onIndent,
  onOutdent,
}: {
  depth: number
  parentId: string | null
  parentNumber: number | null
  inherited: InheritedTaskAttributes | undefined
  onClose: () => void
  onIndent: () => void
  onOutdent: () => void
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || e.defaultPrevented) return
    e.preventDefault()
    if (e.shiftKey) {
      onOutdent()
    } else {
      onIndent()
    }
  }

  // CreateTaskInline's optional props are exactOptionalPropertyTypes-strict
  // (no explicit `undefined`), so a null/undefined value here means
  // omitting the prop entirely rather than passing it through as-is.
  return (
    <div
      onKeyDown={handleKeyDown}
      className="border-b border-border"
      style={{ paddingLeft: `${String(12 + depth * 14)}px` }}
    >
      <CreateTaskInline
        {...(parentId != null ? { parentId } : {})}
        {...(parentNumber != null ? { parentTaskNumber: parentNumber } : {})}
        {...(inherited != null ? { inherited } : {})}
        closeOnSubmit={false}
        onClose={onClose}
      />
    </div>
  )
}
