import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useDayViewQueueTransition } from '#hooks/use-day-view-queue-transition'

describe('useDayViewQueueTransition', () => {
  it('retains the settled queue while returning to its date', () => {
    const initialProps = {
      context: 'work' as const,
      date: '2026-07-20',
      scope: 'compact',
      value: 'initial queue',
      isReady: true,
      hasError: false,
    }
    const { result, rerender } = renderHook(
      (props) => useDayViewQueueTransition(props),
      { initialProps },
    )
    const outputs = [result.current]

    rerender({
      ...initialProps,
      date: '2026-07-27',
      value: 'unsettled queue for B',
      isReady: false,
    })
    outputs.push(result.current)

    rerender({
      ...initialProps,
      value: 'unsettled queue for A',
      isReady: false,
    })
    outputs.push(result.current)

    rerender(initialProps)
    outputs.push(result.current)

    expect(outputs).toEqual([
      {
        value: 'initial queue',
        isRetainingPreviousQueue: false,
        isReady: true,
        hasError: false,
      },
      {
        value: 'initial queue',
        isRetainingPreviousQueue: true,
        isReady: false,
        hasError: false,
      },
      {
        value: 'initial queue',
        isRetainingPreviousQueue: true,
        isReady: false,
        hasError: false,
      },
      {
        value: 'initial queue',
        isRetainingPreviousQueue: false,
        isReady: true,
        hasError: false,
      },
    ])
  })

  it('does not retain the queue for a same-date readiness drop', () => {
    const initialProps = {
      context: 'work' as const,
      date: '2026-07-20',
      scope: 'compact',
      value: 'initial queue',
      isReady: true,
      hasError: false,
    }
    const { result, rerender } = renderHook(
      (props) => useDayViewQueueTransition(props),
      { initialProps },
    )

    rerender({ ...initialProps, value: 'unsettled queue', isReady: false })

    expect(result.current).toEqual({
      value: 'unsettled queue',
      isRetainingPreviousQueue: false,
      isReady: false,
      hasError: false,
    })
  })
})
