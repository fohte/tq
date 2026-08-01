import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Sidebar } from '#components/layout/sidebar'
import { ContextFilterProvider } from '#hooks/use-context-filter'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    ...props
  }: { children: React.ReactNode } & Record<string, unknown>) => (
    <a href={typeof props['to'] === 'string' ? props['to'] : '#'}>{children}</a>
  ),
  useMatchRoute: () => () => false,
}))

function renderSidebar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ContextFilterProvider>
        <Sidebar />
      </ContextFilterProvider>
    </QueryClientProvider>,
  )
}

describe('Sidebar', () => {
  it('is hidden below the md breakpoint', () => {
    renderSidebar()
    expect(screen.getByRole('complementary').className).toBe(
      'hidden h-screen w-[200px] shrink-0 flex-col border-r border-border bg-sidebar md:flex',
    )
  })
})
