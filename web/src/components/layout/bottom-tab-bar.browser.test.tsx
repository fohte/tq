import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'

import { BottomTabBar } from '#components/layout/bottom-tab-bar'
import { assertDefined } from '#lib/test-utils'
import { MOBILE_VIEWPORT } from '#storybook-config/screenshot-viewports'

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

async function renderBottomTabBar(
  onSearch: () => void = vi.fn(),
  onNewTask: () => void = vi.fn(),
) {
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => <BottomTabBar onSearch={onSearch} onNewTask={onNewTask} />,
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
    const nav = screen.getByRole('navigation', { hidden: true })

    const visibility = Array.of<string | boolean>(
      nav.checkVisibility(),
      nav.className,
    )

    expect(visibility).toEqual([
      false,
      'sticky bottom-0 flex shrink-0 flex-col border-t border-border bg-background md:hidden',
    ])
  })

  it('shows four route links followed by the search and new actions', async () => {
    await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    await renderBottomTabBar()
    const nav = screen.getByRole('navigation')
    const row = assertDefined(
      nav.querySelector('div'),
      'BottomTabBar renders a row wrapping tabs and actions',
    )

    const renderedItems = Array.from(row.children, (item) => ({
      element: item.tagName.toLowerCase(),
      label: item.textContent.trim(),
      destination: item.getAttribute('href'),
      type: item instanceof HTMLButtonElement ? item.type : null,
    }))

    expect(renderedItems).toEqual([
      {
        element: 'a',
        label: 'browse',
        destination: '/browse',
        type: null,
      },
      {
        element: 'a',
        label: 'today',
        destination: '/today',
        type: null,
      },
      {
        element: 'a',
        label: 'calendar',
        destination: '/',
        type: null,
      },
      {
        element: 'a',
        label: 'tasks',
        destination: '/tasks',
        type: null,
      },
      {
        element: 'button',
        label: 'search',
        destination: null,
        type: 'button',
      },
      {
        element: 'button',
        label: 'new',
        destination: null,
        type: 'button',
      },
    ])
  })

  it('calls onSearch when the search action is clicked', async () => {
    await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    const actions: string[] = []
    await renderBottomTabBar(
      () => {
        actions.push('search')
      },
      () => {},
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'search' }))

    expect(actions).toEqual(['search'])
  })

  it('calls onNewTask when the new action is clicked', async () => {
    await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    const actions: string[] = []
    await renderBottomTabBar(
      () => {},
      () => {
        actions.push('new')
      },
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'new' }))

    expect(actions).toEqual(['new'])
  })
})
