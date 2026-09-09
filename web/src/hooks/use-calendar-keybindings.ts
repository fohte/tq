import { useEffect } from 'react'

import type { CalendarViewType } from '#components/calendar/calendar-header'
import {
  isBaseUiDialogOpen,
  isEditableTarget,
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.repeat ||
        isEditableTarget(e.target) ||
        isBaseUiDialogOpen()
      ) {
        return
      }

      switch (e.key) {
        case 't':
          e.preventDefault()
          onToday()
          return
        case 'ArrowLeft':
          e.preventDefault()
          onPrev()
          return
        case 'ArrowRight':
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
    }
  }, [onToday, onPrev, onNext, onViewChange])
}
