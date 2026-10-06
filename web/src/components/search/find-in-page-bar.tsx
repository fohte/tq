import { Button } from '@fohte/ui/button'
import { Input } from '@fohte/ui/input'
import { ArrowDown, ArrowUp, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { KeybindHint } from '#components/ui/keybind-hint'

type WindowWithFind = Window & {
  find: (
    text: string,
    caseSensitive?: boolean,
    backwards?: boolean,
    wrapAround?: boolean,
  ) => boolean
}

function hasWindowFind(value: Window): value is WindowWithFind {
  return 'find' in value && typeof value.find === 'function'
}

export function FindInPageBar({
  open,
  requestId,
  onClose,
}: {
  open: boolean
  requestId: number
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return

    inputRef.current?.focus()
    inputRef.current?.select()
  }, [open, requestId])

  if (!open) return null

  const findMatch = (backwards: boolean) => {
    const input = inputRef.current
    if (query.length === 0 || input === null || !hasWindowFind(window)) return

    window.find(query, false, backwards, true)
  }

  return (
    <div
      role="search"
      aria-label="Find in page"
      className="fixed inset-x-4 top-4 z-50 flex w-auto items-center gap-1 border border-border-strong bg-popover px-2 py-1.5 text-popover-foreground shadow-lg sm:inset-x-auto sm:right-4 sm:w-72"
    >
      <Search
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
      <Input
        ref={inputRef}
        type="text"
        variant="ghost"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          } else if (event.key === 'Enter') {
            event.preventDefault()
            findMatch(event.shiftKey)
          }
        }}
        placeholder="Find in page..."
        aria-label="Find in page"
        className="min-w-0 flex-1"
      />
      <Button
        type="button"
        variant="ghost"
        aria-label="Find previous match"
        className="size-8 shrink-0 rounded-none p-0"
        onClick={() => {
          findMatch(true)
        }}
      >
        <ArrowUp aria-hidden="true" className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        aria-label="Find next match"
        className="size-8 shrink-0 rounded-none p-0"
        onClick={() => {
          findMatch(false)
        }}
      >
        <ArrowDown aria-hidden="true" className="size-4" />
      </Button>
      <KeybindHint variant="boxed" className="hidden sm:inline-flex">
        Esc
      </KeybindHint>
      <Button
        type="button"
        variant="ghost"
        aria-label="Close find bar"
        className="size-8 shrink-0 rounded-none p-0"
        onClick={onClose}
      >
        <X aria-hidden="true" className="size-4" />
      </Button>
    </div>
  )
}
