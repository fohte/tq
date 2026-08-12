import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  BOTTOM_TAB_BAR_HEIGHT_CLASS,
  BottomTabBar,
} from '#components/layout/bottom-tab-bar'

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
      `flex ${BOTTOM_TAB_BAR_HEIGHT_CLASS} shrink-0 items-stretch border-t border-border bg-background md:hidden`,
    )
  })
})
