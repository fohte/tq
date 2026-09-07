import { X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { AnchoredPopup } from '#components/ui/anchored-popup'
import { Button } from '#components/ui/button'
import { Chip } from '#components/ui/chip'
import { Input } from '#components/ui/input'
import { useCurrentContext } from '#hooks/use-current-context'
import { useLabels } from '#hooks/use-labels'
import type { LabelTreeNode } from '#lib/tag-tree'
import { buildLabelTree, flattenLabelTree } from '#lib/tag-tree'
import { cn } from '#lib/utils'

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
        <button
          type="button"
          style={{ paddingLeft: `${String(12 + depth * 12)}px` }}
          className={cn(
            'w-full py-1.5 pr-3 text-left font-mono text-xs',
            index === selectedIndex
              ? 'bg-accent text-accent-foreground'
              : 'text-popover-foreground hover:bg-accent/50',
          )}
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(node.name)
          }}
        >
          #{displayName}
        </button>
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
}: {
  labels: string[]
  onLabelsChange: (next: string[]) => void
}) {
  const context = useCurrentContext()
  const { data: labelsData } = useLabels({ context })
  const [isAdding, setIsAdding] = useState(false)
  const [input, setInput] = useState('')
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
        <Chip key={label} size="sm" className="gap-1 py-px pr-0.5">
          <span className="text-primary font-bold">#</span>
          {label}
          <button
            type="button"
            onClick={() => {
              removeTag(label)
            }}
            aria-label={`Remove ${label}`}
            className="text-muted-foreground-faint hover:text-destructive"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </Chip>
      ))}

      {isAdding ? (
        <>
          <Input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            onBlur={closeAdding}
            placeholder="tag name"
            autoFocus
            className="h-auto w-24 border-0 bg-transparent p-0 font-mono text-xs shadow-none focus-visible:ring-0"
          />
          <AnchoredPopup
            open={suggestions.length > 0}
            anchor={inputRef}
            initialFocus={false}
            className="w-40"
          >
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
          </AnchoredPopup>
        </>
      ) : (
        <Button
          type="button"
          variant="link"
          size="xs"
          className="h-auto p-0 text-muted-foreground-faint hover:text-foreground"
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
