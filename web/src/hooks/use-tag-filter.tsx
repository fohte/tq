import type { ReactNode } from 'react'
import { createContext, useContext, useState } from 'react'

interface TagFilterState {
  tag: string | null
  setTag: (tag: string | null) => void
}

const TagFilterContext = createContext<TagFilterState | null>(null)

export function TagFilterProvider({ children }: { children: ReactNode }) {
  const [tag, setTag] = useState<string | null>(null)

  return (
    <TagFilterContext.Provider value={{ tag, setTag }}>
      {children}
    </TagFilterContext.Provider>
  )
}

export function useTagFilter(): TagFilterState {
  const ctx = useContext(TagFilterContext)
  if (!ctx) {
    throw new Error('useTagFilter must be used within a TagFilterProvider')
  }
  return ctx
}

/** Whether `name` is the active tag filter, and a handler to toggle it. */
export function useTagToggle(name: string): {
  isActive: boolean
  toggle: () => void
} {
  const { tag, setTag } = useTagFilter()
  const isActive = tag === name
  return {
    isActive,
    toggle: () => {
      setTag(isActive ? null : name)
    },
  }
}
