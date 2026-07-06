import { render, screen } from '@testing-library/react'
import { Sidebar } from '@web/components/layout/sidebar'
import { ContextFilterProvider } from '@web/hooks/use-context-filter'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    ...props
  }: { children: React.ReactNode } & Record<string, unknown>) => (
    <a href={typeof props['to'] === 'string' ? props['to'] : '#'}>{children}</a>
  ),
  useMatchRoute: () => () => false,
}))

vi.mock('@web/hooks/use-projects', () => ({
  useProjects: () => ({ data: undefined }),
}))

describe('Sidebar', () => {
  it('is hidden below the md breakpoint so the bottom tab bar takes over navigation', () => {
    render(
      <ContextFilterProvider>
        <Sidebar />
      </ContextFilterProvider>,
    )
    expect(screen.getByRole('complementary').className).toBe(
      'hidden md:flex h-screen w-14 flex-col items-center border-r border-border bg-sidebar py-4',
    )
  })
})
