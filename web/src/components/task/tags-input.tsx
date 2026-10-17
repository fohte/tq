import { Button } from '@fohte/ui/button'
import { Chip } from '@fohte/ui/chip'
import { Input } from '@fohte/ui/input'
import { List, ListItem } from '@fohte/ui/list'
import { Popover, PopoverContent } from '@fohte/ui/popover'
import { useMemo, useRef, useState } from 'react'

import { type LabelFilter, useLabelsForContext } from '#hooks/use-labels'
import type { LabelTreeNode } from '#lib/tag-tree'
import { buildLabelTree, flattenLabelTree } from '#lib/tag-tree'

// Synthesized ancestor nodes (e.g. "dev" when only "dev/tq" exists) are
// selectable as tags.
function LabelSuggestion({
  node,
  depth,
  indexByName,
  selectedIndex,
  onSelect,
}: {
  node: LabelTreeNode
  depth: number
  indexByName: Map<string, number>
  selectedIndex: number
  onSelect: (name: string) => void
}) {
  const index = indexByName.get(node.name)
  const displayName = node.name.slice(node.name.lastIndexOf('/') + 1)

  return (
    <>
      {/* Already-attached labels are excluded from indexByName; selecting
          one would otherwise no-op against addTag's duplicate guard. */}
      {index != null && (
        <ListItem
          indent={depth}
          highlighted={index === selectedIndex}
          onSelect={() => {
            onSelect(node.name)
          }}
        >
          <span className="font-mono">#{displayName}</span>
        </ListItem>
      )}
      {node.children.map((child) => (
        <LabelSuggestion
          key={child.name}
          node={child}
          depth={index != null ? depth + 1 : depth}
          indexByName={indexByName}
          selectedIndex={selectedIndex}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

export function TagsInput({
  labels,
  onLabelsChange,
  context,
  defaultIsAdding = false,
  defaultInput = '',
}: {
  labels: string[]
  onLabelsChange: (next: string[]) => void
  context?: LabelFilter['context'] | ''
  /** Lets a story render the "adding a tag" state without a play function. */
  defaultIsAdding?: boolean
  defaultInput?: string
}) {
  const { data: labelsData } = useLabelsForContext(context)
  const [isAdding, setIsAdding] = useState(defaultIsAdding)
  const [input, setInput] = useState(defaultInput)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const existingLabels = useMemo(() => new Set(labels), [labels])

  const suggestionTree = useMemo(() => {
    const candidates = (labelsData ?? [])
      .map((l) => l.name)
      .filter((name) => !existingLabels.has(name))
    const filtered = input
      ? candidates.filter((name) =>
          name.toLowerCase().includes(input.toLowerCase()),
        )
      : candidates
    return buildLabelTree(filtered)
  }, [labelsData, existingLabels, input])

  // buildLabelTree may synthesize an ancestor (e.g. "dev") that's already
  // attached even though it was excluded from `candidates` above, so filter
  // it out again here rather than in the tree itself.
  const suggestions = useMemo(
    () =>
      flattenLabelTree(suggestionTree).filter(
        (name) => !existingLabels.has(name),
      ),
    [suggestionTree, existingLabels],
  )
  const suggestionIndexByName = useMemo(
    () => new Map(suggestions.map((name, index) => [name, index])),
    [suggestions],
  )

  const addTag = (name: string) => {
    const trimmed = name.trim()
    if (trimmed && !labels.includes(trimmed)) {
      onLabelsChange([...labels, trimmed])
    }
    setInput('')
    setSelectedIndex(0)
  }

  const removeTag = (name: string) => {
    onLabelsChange(labels.filter((l) => l !== name))
  }

  const closeAdding = () => {
    setIsAdding(false)
    setInput('')
    setSelectedIndex(0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return

    switch (e.key) {
      case 'ArrowDown':
        if (suggestions.length === 0) return
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % suggestions.length)
        break
      case 'ArrowUp':
        if (suggestions.length === 0) return
        e.preventDefault()
        setSelectedIndex(
          (prev) => (prev - 1 + suggestions.length) % suggestions.length,
        )
        break
      case 'Enter':
        e.preventDefault()
        addTag(suggestions[selectedIndex] ?? input)
        break
      case 'Tab':
        if (suggestions.length === 0 && !input.trim()) return
        e.preventDefault()
        addTag(suggestions[selectedIndex] ?? input)
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        closeAdding()
        break
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {labels.map((label) => (
        <Chip
          key={label}
          size="sm"
          onRemove={() => {
            removeTag(label)
          }}
          removeLabel={`Remove ${label}`}
        >
          <span className="text-primary font-bold">#</span>
          {label}
        </Chip>
      ))}

      {isAdding ? (
        <>
          <div className="px-1">
            <Input
              ref={inputRef}
              type="text"
              variant="ghost"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                setSelectedIndex(0)
              }}
              onKeyDown={handleKeyDown}
              onBlur={closeAdding}
              placeholder="tag name"
              autoFocus
              className="w-24"
            />
          </div>
          <Popover open={suggestions.length > 0} anchor={inputRef}>
            <PopoverContent
              initialFocus={false}
              padding="none"
              className="w-40"
            >
              <div className="text-popover-foreground">
                <List role="listbox">
                  {suggestionTree.map((node) => (
                    <LabelSuggestion
                      key={node.name}
                      node={node}
                      depth={0}
                      indexByName={suggestionIndexByName}
                      selectedIndex={selectedIndex}
                      onSelect={addTag}
                    />
                  ))}
                </List>
              </div>
            </PopoverContent>
          </Popover>
        </>
      ) : (
        <Button
          type="button"
          variant="plain"
          className="w-fit"
          onClick={() => {
            setIsAdding(true)
          }}
        >
          + add tag
        </Button>
      )}
    </div>
  )
}
