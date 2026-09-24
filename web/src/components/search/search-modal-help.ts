import { useEffect, useState } from 'react'

export function useSearchModalHelp(
  modalOpen: boolean,
  inputRef: React.RefObject<HTMLInputElement | null>,
) {
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  useEffect(() => {
    setIsHelpOpen(false)
  }, [modalOpen])

  const closeHelp = () => {
    setIsHelpOpen(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (
    event: React.KeyboardEvent,
    searchInputValue: string,
  ) => {
    if (isHelpOpen) {
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        closeHelp()
      }
      return true
    }

    if (event.key === '?' && searchInputValue.length === 0) {
      event.preventDefault()
      setIsHelpOpen(true)
      return true
    }

    return false
  }

  return { isHelpOpen, closeHelp, handleKeyDown }
}
