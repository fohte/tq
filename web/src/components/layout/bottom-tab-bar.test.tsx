import { render, screen } from '@testing-library/react'
import { BottomTabBar } from '@web/components/layout/bottom-tab-bar'
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

describe('BottomTabBar', () => {
  it('is hidden above the md breakpoint so the sidebar takes over navigation', () => {
    render(<BottomTabBar />)
    expect(screen.getByRole('navigation').className).toBe(
      'fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t border-border bg-background md:hidden',
    )
  })
})
