import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import { dispatchNewTaskShortcut } from '#hooks/use-new-task-shortcut'
import { type NavKeybinding, navKeybindings } from '#lib/keybindings'

const CHORD_TIMEOUT_MS = 1000

const navByChord: Map<string, NavKeybinding> = new Map(
  Object.values(navKeybindings).map((keybinding) => [
    keybinding.keys,
    keybinding,
  ]),
)

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

// Base UI's Dialog sets this on <html> while any modal (e.g. CreateTaskModal)
// is open; SearchModal isn't Base UI-based, so its own `searchOpen` is passed
// in separately.
function isBaseUiDialogOpen(): boolean {
  return document.documentElement.hasAttribute('data-base-ui-scroll-locked')
}

export function useGlobalKeybindings({
  searchOpen,
  onSearchOpenChange,
}: {
  searchOpen: boolean
  onSearchOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()

  useEffect(() => {
    let awaitingChord = false
    let chordTimeout: ReturnType<typeof setTimeout> | undefined

    const resetChord = () => {
      awaitingChord = false
      clearTimeout(chordTimeout)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onSearchOpenChange(!searchOpen)
        return
      }

      if (e.repeat) return

      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        searchOpen ||
        isEditableTarget(e.target) ||
        isBaseUiDialogOpen()
      ) {
        resetChord()
        return
      }

      const key = e.key.toLowerCase()

      if (awaitingChord) {
        resetChord()
        const nav = navByChord.get(`g ${key}`)
        if (nav != null) {
          e.preventDefault()
          void navigate({ to: nav.to })
        }
        return
      }

      if (key === 'g') {
        awaitingChord = true
        chordTimeout = setTimeout(resetChord, CHORD_TIMEOUT_MS)
        return
      }

      if (key === 'n') {
        e.preventDefault()
        void navigate({ to: '/tasks' }).then(() => {
          dispatchNewTaskShortcut()
        })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      resetChord()
    }
  }, [navigate, onSearchOpenChange, searchOpen])
}
