import { useEffect, useRef } from 'react'

interface UseInfiniteScrollSentinelOptions {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  fetchNextPage?: (() => unknown) | undefined
}

export function useInfiniteScrollSentinel({
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  fetchNextPage,
}: UseInfiniteScrollSentinelOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!hasNextPage) return
    const sentinel = sentinelRef.current
    if (sentinel == null) return

    const observer = new IntersectionObserver((entries) => {
      if (
        entries[0]?.isIntersecting === true &&
        !isFetchingNextPage &&
        !isFetchNextPageError
      ) {
        void fetchNextPage?.()
      }
    })
    observer.observe(sentinel)
    return () => {
      observer.disconnect()
    }
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage])

  return sentinelRef
}
