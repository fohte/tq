import { useNavigate, useSearch } from '@tanstack/react-router'

interface TagFilterState {
  tag: string | null
  setTag: (tag: string | null) => void
}

export function useTagFilter(): TagFilterState {
  const { tag } = useSearch({ strict: false })
  // `from: '/'` only pins the *type* used for the search updater below (this
  // hook is called from many routes) — navigate() with no `to` always stays
  // on the current URL and only touches search at runtime.
  const navigate = useNavigate({ from: '/' })

  return {
    tag: tag ?? null,
    setTag: (nextTag) => {
      void navigate({
        search: (prev) => {
          if (nextTag == null) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to drop it from `rest`
            const { tag: _tag, ...rest } = prev
            return rest
          }
          return { ...prev, tag: nextTag }
        },
        replace: true,
      })
    },
  }
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
