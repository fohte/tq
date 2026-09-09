import { useEffect } from 'react'

import type { CalendarViewType } from '#components/calendar/calendar-header'
import {
  CHORD_TIMEOUT_MS,
  shouldIgnoreShortcut,
} from '#hooks/use-global-keybindings'

export function useCalendarKeybindings({
  onToday,
  onPrev,
  onNext,
  onViewChange,
}: {
  onToday: () => void
  onPrev: () => void
  onNext: () => void
  onViewChange: (view: CalendarViewType) => void
}) {
  useEffect(() => {
    // useGlobalKeybindings treats any key right after 'g' as the possible
    // second half of a "g <key>" chord (e.g. g d -> /today). Mirror that
    // window here so this hook's bare 'd'/'t' shortcuts don't also fire for
    // the same keystroke.
    let awaitingChord = false
    let chordTimeout: ReturnType<typeof setTimeout> | undefined

    const resetChord = () => {
      awaitingChord = false
      clearTimeout(chordTimeout)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (shouldIgnoreShortcut(e)) {
        resetChord()
        return
      }

      const key = e.key.toLowerCase()

      if (awaitingChord) {
        resetChord()
        return
      }

      if (key === 'g') {
        awaitingChord = true
        chordTimeout = setTimeout(resetChord, CHORD_TIMEOUT_MS)
        return
      }

      switch (key) {
        case 't':
          e.preventDefault()
          onToday()
          return
        case 'arrowleft':
          e.preventDefault()
          onPrev()
          return
        case 'arrowright':
          e.preventDefault()
          onNext()
          return
        case 'd':
          e.preventDefault()
          onViewChange('day')
          return
        case 'w':
          e.preventDefault()
          onViewChange('week')
          return
        case 'm':
          e.preventDefault()
          onViewChange('month')
          return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      resetChord()
    }
  }, [onToday, onPrev, onNext, onViewChange])
}
