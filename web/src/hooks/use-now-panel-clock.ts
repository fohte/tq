import { useEffect, useState } from 'react'

export function useNowPanelClock(enabled: boolean): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!enabled) return

    const updateNow = () => {
      setNow(new Date())
    }
    updateNow()
    const intervalId = window.setInterval(updateNow, 60_000)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [enabled])

  return now
}
