import { X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { SidebarField } from '#components/task/sidebar-field'
import { Button } from '#components/ui/button'
import { Chip } from '#components/ui/chip'
import { Input } from '#components/ui/input'
import { useLabels } from '#hooks/use-labels'
import { useUpdateTask } from '#hooks/use-tasks'
import { cn } from '#lib/utils'

export function SidebarTagsField({
  taskId,
  labels,
}: {
  taskId: string
  labels: string[]
}) {
  const updateTask = useUpdateTask()
  const { data: labelsData } = useLabels()
  const [isAdding, setIsAdding] = useState(false)
  const [input, setInput] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const suggestions = useMemo(() => {
    const existing = new Set(labels)
    const candidates = (labelsData ?? [])
      .map((l) => l.name)
      .filter((name) => !existing.has(name))
    if (!input) return candidates
    const lower = input.toLowerCase()
    return candidates.filter((name) => name.toLowerCase().includes(lower))
  }, [labelsData, labels, input])

  const setLabels = (next: string[]) => {
    updateTask.mutate({ id: taskId, input: { labels: next } })
  }

  const addTag = (name: string) => {
    const trimmed = name.trim()
    if (trimmed && !labels.includes(trimmed)) {
      setLabels([...labels, trimmed])
    }
    setInput('')
    setSelectedIndex(0)
  }

  const removeTag = (name: string) => {
    setLabels(labels.filter((l) => l !== name))
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
        closeAdding()
        break
    }
  }

  return (
    <SidebarField label="TAGS">
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
          <div className="relative">
            <Input
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
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 z-50 mt-1 w-40 rounded-md border border-border bg-popover py-1 shadow-md">
                {suggestions.map((name, index) => (
                  <button
                    key={name}
                    type="button"
                    className={cn(
                      'w-full px-3 py-1.5 text-left font-mono text-xs',
                      index === selectedIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'text-popover-foreground hover:bg-accent/50',
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      addTag(name)
                    }}
                  >
                    #{name}
                  </button>
                ))}
              </div>
            )}
          </div>
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
    </SidebarField>
  )
}
