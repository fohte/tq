import { useEffect, useState } from 'react'

export function useSearchModalHelp(
  modalOpen: boolean,
  inputRef: React.RefObject<HTMLInputElement | null>,
  backButtonRef: React.RefObject<HTMLButtonElement | null>,
  defaultOpen = false,
) {
  const [isHelpOpen, setIsHelpOpen] = useState(defaultOpen)

  useEffect(() => {
    if (!modalOpen) setIsHelpOpen(false)
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
      } else if (event.key === 'Tab') {
        event.preventDefault()
        const nextFocus =
          document.activeElement === inputRef.current
            ? backButtonRef.current
            : inputRef.current
        nextFocus?.focus()
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
