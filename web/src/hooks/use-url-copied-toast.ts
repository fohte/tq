import { useEffect, useState } from 'react'

const URL_COPIED_EVENT = 'tq:url-copied'
const URL_COPIED_FEEDBACK_MS = 1500

export function useUrlCopiedToast(): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let timeoutId: number | null = null

    const handleUrlCopied = (event: Event) => {
      if (!(event instanceof CustomEvent)) return

      const detail: unknown = event.detail
      if (
        typeof detail !== 'object' ||
        detail === null ||
        !('url' in detail) ||
        typeof detail.url !== 'string'
      ) {
        return
      }

      const copiedUrl = detail.url
      setUrl(copiedUrl)

      if (timeoutId !== null) window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        setUrl(null)
        timeoutId = null
      }, URL_COPIED_FEEDBACK_MS)
    }

    window.addEventListener(URL_COPIED_EVENT, handleUrlCopied)
    return () => {
      window.removeEventListener(URL_COPIED_EVENT, handleUrlCopied)
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [])

  return url
}
