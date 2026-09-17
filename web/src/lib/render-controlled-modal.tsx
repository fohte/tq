import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ComponentType } from 'react'
import { useState } from 'react'
import { vi } from 'vitest'

type ControlledModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Renders a modal with `open` managed as real state (instead of a no-op
 * mock) so tests can verify the modal actually leaves the DOM after a close
 * action. Pass `queryClient` to pre-seed query hook caches; the returned
 * `onOpenChange` spy lets a test assert the modal wasn't asked to close.
 */
export function renderControlledModal<P extends ControlledModalProps>(
  Component: ComponentType<P>,
  props: Omit<P, 'open' | 'onOpenChange'>,
  options: { queryClient?: QueryClient } = {},
) {
  const queryClient =
    options.queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
  const onOpenChange = vi.fn()

  function Managed() {
    const [open, setOpen] = useState(true)
    return (
      <Component
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- TS can't verify Omit<P, ...> plus the omitted keys reconstitutes P for a generic P
        {...(props as P)}
        open={open}
        onOpenChange={(next: boolean) => {
          onOpenChange(next)
          setOpen(next)
        }}
      />
    )
  }

  return {
    queryClient,
    onOpenChange,
    ...render(
      <QueryClientProvider client={queryClient}>
        <Managed />
      </QueryClientProvider>,
    ),
  }
}
