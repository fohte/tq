import { useCallback, useEffect, useState } from 'react'

const FIND_IN_PAGE_EVENT = 'tq:find'

export function useFindInPageOpen() {
  const [open, setOpen] = useState(false)
  const [requestId, setRequestId] = useState(0)

  useEffect(() => {
    const handleFindRequest = () => {
      setOpen(true)
      setRequestId((current) => current + 1)
    }

    window.addEventListener(FIND_IN_PAGE_EVENT, handleFindRequest)
    return () => {
      window.removeEventListener(FIND_IN_PAGE_EVENT, handleFindRequest)
    }
  }, [])

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  return { close, open, requestId }
}
