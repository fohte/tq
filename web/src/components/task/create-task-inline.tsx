import { Plus, X } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'

import { CreateTaskInlineExistingMenu } from '#components/task/create-task-inline-existing-menu'
import { CreateTaskInlineParentMenu } from '#components/task/create-task-inline-parent-menu'
import { CreateTaskInputAccessoryBar } from '#components/task/create-task-input-accessory-bar'
import { LinkExistingTaskDialog } from '#components/task/link-existing-task-dialog'
import { ProjectChip } from '#components/task/project-chip'
import { Button } from '#components/ui/button'
import { Chip } from '#components/ui/chip'
import { Input } from '#components/ui/input'
import { useExistingTaskLink } from '#hooks/use-existing-task-link'
import { useLabels } from '#hooks/use-labels'
import { useParentPicker } from '#hooks/use-parent-picker'
import { useCreateTask } from '#hooks/use-tasks'
import { cycleIndex } from '#lib/cycle-index'
import { formatMinutes } from '#lib/format'
import {
  detectTrigger,
  getSuggestions,
  parseTaskInput,
  type SuggestionItem,
  type TaskContext,
  type TriggerChar,
} from '#lib/task-input-parser'
import { cn } from '#lib/utils'

export interface InheritedTaskAttributes {
  context: TaskContext
  projectId: string | null
  labels: string[]
}

export function CreateTaskInline({
  onClose,
  defaultStartDate,
  parentId,
  parentTaskNumber,
  inherited,
  closeOnSubmit = true,
}: {
  onClose: () => void
  defaultStartDate?: string
  /** When set, the created task becomes a child of this task. */
  parentId?: string
  /** The current task's own number — used only for the "link existing task"
   * confirmation dialog copy. Required whenever `parentId` is set. */
  parentTaskNumber?: number
  /** Parent attributes to inherit (typed notation still wins over these). */
  inherited?: InheritedTaskAttributes
  /** Whether a successful submit should call `onClose` (default: true). */
  closeOnSubmit?: boolean
}) {
  const [input, setInput] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [cursorTrigger, setCursorTrigger] = useState<{
    trigger: TriggerChar
    partial: string
    tokenStart: number
  } | null>(null)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const createTask = useCreateTask()
  const { data: labelsData } = useLabels()

  const availableLabels = useMemo(
    () => (labelsData ?? []).map((l) => l.name),
    [labelsData],
  )

  const parsed = useMemo(() => parseTaskInput(input), [input])

  const suggestions = useMemo(() => {
    if (!cursorTrigger) return []
    return getSuggestions(
      cursorTrigger.trigger,
      cursorTrigger.partial,
      availableLabels,
    )
  }, [cursorTrigger, availableLabels])

  const updateTrigger = useCallback(
    (value: string, cursorPos: number) => {
      const info = detectTrigger(value, cursorPos)
      setCursorTrigger(info)
      if (info) {
        const items = getSuggestions(
          info.trigger,
          info.partial,
          availableLabels,
        )
        setShowSuggestions(items.length > 0)
        setSelectedIndex(0)
      } else {
        setShowSuggestions(false)
      }
    },
    [availableLabels],
  )

  const applySuggestion = useCallback(
    (item: SuggestionItem) => {
      if (!cursorTrigger) return

      const before = input.slice(0, cursorTrigger.tokenStart)
      const tokenEnd = input.indexOf(' ', cursorTrigger.tokenStart)
      const after = input.slice(tokenEnd === -1 ? input.length : tokenEnd)

      const trigger = cursorTrigger.trigger
      const newInput = `${before}${trigger}${item.value}${after ? '' : ' '}${after}`
      setInput(newInput)
      setShowSuggestions(false)
      setCursorTrigger(null)

      requestAnimationFrame(() => {
        const el = inputRef.current
        if (el) {
          el.focus()
          const pos = before.length + 1 + item.value.length + (after ? 0 : 1)
          el.setSelectionRange(pos, pos)
        }
      })
    },
    [input, cursorTrigger],
  )

  // Inserts `trigger` at the input's current cursor position, as if the
  // user had typed it — used by the mobile accessory bar.
  const insertTrigger = useCallback(
    (trigger: TriggerChar) => {
      const cursorPos = inputRef.current?.selectionStart ?? input.length
      const before = input.slice(0, cursorPos)
      const after = input.slice(cursorPos)
      const needsLeadingSpace = before.length > 0 && !before.endsWith(' ')
      const needsTrailingSpace = after.length > 0 && !after.startsWith(' ')
      const leadingSpace = needsLeadingSpace ? ' ' : ''
      const trailingSpace = needsTrailingSpace ? ' ' : ''
      const newInput = `${before}${leadingSpace}${trigger}${trailingSpace}${after}`
      setInput(newInput)

      requestAnimationFrame(() => {
        const el = inputRef.current
        if (el) {
          el.focus()
          // Caret lands right after the trigger char (before the trailing
          // space, if any) so `updateTrigger` sees an empty partial — same
          // as if the user had just typed the trigger key by hand.
          const pos = before.length + leadingSpace.length + trigger.length
          el.setSelectionRange(pos, pos)
          updateTrigger(newInput, pos)
        }
      })
    },
    [input, updateTrigger],
  )

  const {
    selectedParent,
    setSelectedParent,
    showParentMenu,
    parentCandidates,
    isParentSearchFetching,
    parentMenuIndex,
    resetParentMenu,
    applyParentSelection,
    handleParentMenuKeyDown,
    resolvedParentId,
  } = useParentPicker({
    parentId,
    input,
    setInput,
    cursorTrigger,
    setCursorTrigger,
    parsedParentNumber: parsed.parentNumber,
    inputRef,
  })

  const {
    existingCandidates,
    showExistingMenu,
    existingMenuIndex,
    resetExistingMenu,
    dismissExistingMenu,
    selectCandidate,
    handleExistingMenuKeyDown,
    linkDialogCandidate,
    setLinkDialogCandidate,
    confirmLinkDialog,
  } = useExistingTaskLink({
    parentId,
    parentTaskNumber,
    triggerDropdownActive: cursorTrigger != null,
    title: parsed.title.trim(),
    closeOnSubmit,
    onClose,
    onInputReset: () => {
      setInput('')
    },
  })

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const suggestionsActive = showSuggestions && suggestions.length > 0

    if (e.key === 'Escape') {
      e.preventDefault()
      if (suggestionsActive) {
        setShowSuggestions(false)
        return
      }
      if (showParentMenu) {
        setCursorTrigger(null)
        return
      }
      if (showExistingMenu) {
        dismissExistingMenu()
        return
      }
      onClose()
      return
    }

    if (suggestionsActive) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => cycleIndex(prev, 1, suggestions.length))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => cycleIndex(prev, -1, suggestions.length))
          break
        case 'Enter':
        case 'Tab':
          e.preventDefault()
          {
            const suggestion = suggestions[selectedIndex]
            if (suggestion != null) applySuggestion(suggestion)
          }
          break
      }
      return
    }

    if (showParentMenu) {
      handleParentMenuKeyDown(e)
      return
    }

    if (showExistingMenu) {
      handleExistingMenuKeyDown(e)
    }
  }

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (showSuggestions) return

    if (!parsed.title.trim() || createTask.isPending) return

    const startDate = parsed.startDate ?? defaultStartDate
    const context = parsed.context ?? inherited?.context
    const labels = Array.from(
      new Set([...(inherited?.labels ?? []), ...parsed.labels]),
    )

    createTask.mutate(
      {
        title: parsed.title.trim(),
        ...(parsed.estimatedMinutes != null
          ? { estimatedMinutes: parsed.estimatedMinutes }
          : {}),
        ...(parsed.dueDate != null ? { dueDate: parsed.dueDate } : {}),
        ...(startDate != null ? { startDate } : {}),
        ...(context != null ? { context } : {}),
        ...(labels.length > 0 ? { labels } : {}),
        ...(inherited?.projectId != null
          ? { projectId: inherited.projectId }
          : {}),
        ...(resolvedParentId != null ? { parentId: resolvedParentId } : {}),
      },
      {
        onSuccess: () => {
          setInput('')
          setSelectedParent(null)
          if (closeOnSubmit) onClose()
        },
      },
    )
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInput(value)
    updateTrigger(value, e.target.selectionStart ?? value.length)
    resetExistingMenu()
    resetParentMenu()
  }

  const handleSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    updateTrigger(el.value, el.selectionStart ?? el.value.length)
  }

  // Preview chips for own (typed) fields
  const ownChips: { key: string; label: React.ReactNode }[] = []
  if (parsed.estimatedMinutes != null) {
    ownChips.push({
      key: 'estimate',
      label: formatMinutes(parsed.estimatedMinutes),
    })
  }
  if (parsed.dueDate != null) {
    ownChips.push({ key: 'due', label: `due: ${parsed.dueDate}` })
  }
  if (parsed.startDate != null) {
    ownChips.push({ key: 'start', label: `start: ${parsed.startDate}` })
  }
  for (const label of parsed.labels) {
    ownChips.push({
      key: `label-${label}`,
      label: <LabelChipText label={label} />,
    })
  }
  if (parsed.context != null) {
    ownChips.push({ key: 'context', label: parsed.context })
  }
  if (selectedParent != null) {
    ownChips.push({
      key: 'parent',
      label: `parent: #${String(selectedParent.number)} ${selectedParent.title}`,
    })
  }

  // Preview chips for values inherited from the parent task — dimmer, and
  // suppressed wherever the typed notation already covers the same field.
  const inheritedContextChip =
    parsed.context == null ? inherited?.context : undefined
  const inheritedLabelChips = (inherited?.labels ?? []).filter(
    (label) => !parsed.labels.includes(label),
  )
  const hasInheritedProjectChip = inherited?.projectId != null

  const accessoryTriggers: TriggerChar[] =
    parentId == null ? ['@', '>', '#', '%', '^'] : ['@', '>', '#', '%']

  return (
    <div className="relative">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-3 py-2"
      >
        <div className="relative min-w-0 flex-1">
          <Input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onSelect={handleSelect}
            onClick={handleSelect}
            onFocus={() => {
              setIsInputFocused(true)
            }}
            onBlur={() => {
              setIsInputFocused(false)
            }}
            placeholder={
              parentId == null
                ? 'New task... (@30m @tomorrow #label %work ^parent)'
                : 'New task... (@30m @tomorrow #label %work)'
            }
            autoFocus
            className="h-auto border-0 bg-transparent p-0 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0"
          />

          {/* Suggestion dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 z-50 mt-1 w-48 rounded-md border border-border bg-popover py-1 shadow-md"
            >
              {suggestions.map((item, index) => (
                <button
                  key={item.value}
                  type="button"
                  className={cn(
                    'w-full px-3 py-1.5 text-left text-sm',
                    index === selectedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'text-popover-foreground hover:bg-accent/50',
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    applySuggestion(item)
                  }}
                >
                  {cursorTrigger?.trigger}
                  {item.display}
                </button>
              ))}
            </div>
          )}

          {/* Parent-picker dropdown */}
          {showParentMenu && (
            <CreateTaskInlineParentMenu
              candidates={parentCandidates}
              highlightedIndex={parentMenuIndex}
              isLoading={isParentSearchFetching}
              onSelectCandidate={applyParentSelection}
            />
          )}

          {/* Combined create/existing-task dropdown */}
          {showExistingMenu && (
            <CreateTaskInlineExistingMenu
              title={parsed.title.trim()}
              candidates={existingCandidates}
              highlightedIndex={existingMenuIndex}
              onSelectCandidate={selectCandidate}
            />
          )}
        </div>

        <Button
          type="submit"
          size="icon-xs"
          disabled={!parsed.title.trim() || createTask.isPending}
        >
          <Plus className="h-3 w-3" />
        </Button>
        <Button type="button" variant="ghost" size="icon-xs" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </form>

      {isInputFocused && (
        <CreateTaskInputAccessoryBar
          triggers={accessoryTriggers}
          onTriggerTap={insertTrigger}
        />
      )}

      {/* Preview chips */}
      {(ownChips.length > 0 ||
        inheritedContextChip != null ||
        inheritedLabelChips.length > 0 ||
        hasInheritedProjectChip) && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {ownChips.map((chip) => (
            <Chip key={chip.key} size="sm" active>
              {chip.label}
            </Chip>
          ))}
          {inheritedContextChip != null && (
            <Chip size="sm">{inheritedContextChip}</Chip>
          )}
          {inheritedLabelChips.map((label) => (
            <Chip key={`inherited-label-${label}`} size="sm">
              <LabelChipText label={label} />
            </Chip>
          ))}
          {inherited?.projectId != null && (
            <ProjectChip projectId={inherited.projectId} />
          )}
        </div>
      )}

      {parentTaskNumber != null && (
        <LinkExistingTaskDialog
          candidate={linkDialogCandidate}
          parentTaskNumber={parentTaskNumber}
          open={linkDialogCandidate != null}
          onOpenChange={(open) => {
            if (!open) setLinkDialogCandidate(null)
          }}
          onConfirm={confirmLinkDialog}
        />
      )}
    </div>
  )
}

function LabelChipText({ label }: { label: string }) {
  return (
    <>
      <span className="font-bold text-primary">#</span>
      {label}
    </>
  )
}

export { FloatingActionButton } from '#components/task/floating-action-button'
