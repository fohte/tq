import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { BottomTabBar } from '#components/layout/bottom-tab-bar'

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
  it('is hidden above the md breakpoint', () => {
    render(<BottomTabBar />)
    expect(screen.getByRole('navigation').className).toBe(
      'flex h-[52px] shrink-0 items-stretch border-t border-border bg-background md:hidden',
    )
  })
})
