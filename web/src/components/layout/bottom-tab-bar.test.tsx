import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { BottomTabBar } from '#components/layout/bottom-tab-bar'

// Only Link/useMatchRoute are stubbed — useSearch/useNavigate stay real so
// the embedded ContextFilterInline (via useContextFilter) keeps working.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({
      children,
      ...props
    }: { children: React.ReactNode } & Record<string, unknown>) => (
      <a href={typeof props['to'] === 'string' ? props['to'] : '#'}>
        {children}
      </a>
    ),
    useMatchRoute: () => () => false,
  }
})

async function renderBottomTabBar() {
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => <BottomTabBar />,
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()

  return render(<RouterProvider router={router} />)
}

describe('BottomTabBar', () => {
  it('is hidden above the md breakpoint', async () => {
    await renderBottomTabBar()
    expect(screen.getByRole('navigation').className).toBe(
      'flex shrink-0 flex-col border-t border-border bg-background md:hidden',
    )
  })

  it('renders the context filter switch, defaulting to "all" pressed', async () => {
    await renderBottomTabBar()
    expect(
      screen
        .getAllByRole('button', { name: /^(all|work|personal)$/ })
        .map((button) => ({
          name: button.textContent,
          pressed: button.getAttribute('aria-pressed'),
        })),
    ).toEqual([
      { name: 'all', pressed: 'true' },
      { name: 'work', pressed: 'false' },
      { name: 'personal', pressed: 'false' },
    ])
  })
})
