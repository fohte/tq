import { useNavigate, useSearch } from '@tanstack/react-router'

interface TagFilterState {
  tag: string | null
  setTag: (tag: string | null) => void
}

export function useTagFilter(): TagFilterState {
  const { tag } = useSearch({ strict: false })
  const navigate = useNavigate()

  return {
    tag: tag ?? null,
    setTag: (nextTag) => {
      void navigate({
        to: '.',
        search: (prev) => {
          if (nextTag == null) {
            const { tag: _tag, ...rest } = prev
            void _tag
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
