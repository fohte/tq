import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ComponentType } from 'react'
import { useState } from 'react'

type ControlledModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Renders a modal with `open` managed as real state (instead of a no-op
 * mock) so tests can verify the modal actually leaves the DOM after a close
 * action.
 */
export function renderControlledModal<P extends ControlledModalProps>(
  Component: ComponentType<P>,
  props: Omit<P, 'open' | 'onOpenChange'>,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  function Managed() {
    const [open, setOpen] = useState(true)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- TS can't verify Omit<P, ...> plus the omitted keys reconstitutes P for a generic P
    return <Component {...(props as P)} open={open} onOpenChange={setOpen} />
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <Managed />
    </QueryClientProvider>,
  )
}
