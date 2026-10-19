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

const routeState = vi.hoisted(() => ({ currentPath: '/' }))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({
      children,
      to,
      className,
      'aria-current': ariaCurrent,
      'data-slot': dataSlot,
    }: {
      children: React.ReactNode
      to: string
      className?: string
      'aria-current'?: 'page'
      'data-slot'?: string
    }) => (
      <a
        href={to}
        className={className}
        aria-current={ariaCurrent}
        data-slot={dataSlot}
      >
        {children}
      </a>
    ),
    useMatchRoute:
      () =>
      ({ to, fuzzy }: { to: string; fuzzy?: boolean }) =>
        fuzzy === true
          ? routeState.currentPath === to ||
            routeState.currentPath.startsWith(`${to}/`)
          : routeState.currentPath === to,
  }
})

async function renderBottomTabBar({
  currentPath = '/',
  onSearch = vi.fn(),
  onNewTask = vi.fn(),
}: {
  currentPath?: string
  onSearch?: () => void
  onNewTask?: () => void
} = {}) {
  routeState.currentPath = currentPath
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

async function readNavigationLayout(nav: HTMLElement) {
  const items = Array.from(
    nav.querySelectorAll<HTMLElement>('[data-slot="bottom-navigation-item"]'),
  )
  const labels = Array.from(
    nav.querySelectorAll<HTMLElement>('[data-slot="bottom-navigation-label"]'),
  )
  labels.forEach((label) => {
    label.style.fontSize = '20px'
  })

  const rects = items.map((item) => item.getBoundingClientRect())
  const firstRect = assertDefined(rects[0])
  const oneRow = rects.every(
    (rect) => rect.top === firstRect.top && rect.bottom === firstRect.bottom,
  )
  const noOverlap = rects
    .slice(1)
    .every((rect, index) => assertDefined(rects[index]).right <= rect.left)
  const labelsStayOnOneLine = labels.every(
    (label) => label.getClientRects().length === 1,
  )
  const overflowsHorizontally = nav.scrollWidth > nav.clientWidth

  const lastItem = assertDefined(items.at(-1))
  lastItem.focus()
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      resolve()
    })
  })

  const lastRect = lastItem.getBoundingClientRect()
  const navRect = nav.getBoundingClientRect()

  return {
    labels: labels.map((label) => label.textContent),
    oneRow,
    noOverlap,
    labelsStayOnOneLine,
    overflowsHorizontally,
    focusScrolls: nav.scrollLeft > 0,
    lastItemVisible:
      lastRect.left >= navRect.left && lastRect.right <= navRect.right,
  }
}

describe('BottomTabBar', () => {
  it('is hidden above the md breakpoint', async () => {
    await renderBottomTabBar()
    const nav = screen.getByRole('navigation', { hidden: true })

    const state = Array.of(
      nav.checkVisibility(),
      assertDefined(nav.parentElement).classList.contains('md:hidden'),
    )

    expect(state).toEqual([false, true])
  })

  it('shows four route links followed by the search and new actions', async () => {
    await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    await renderBottomTabBar()
    const nav = screen.getByRole('navigation')
    const renderedItems = Array.from(
      nav.querySelectorAll('[data-slot="bottom-navigation-item"]'),
      (item) => ({
        element: item.tagName.toLowerCase(),
        label: item.textContent.trim(),
        destination: item.getAttribute('href'),
        type: item instanceof HTMLButtonElement ? item.type : null,
      }),
    )

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

  it('keeps all icons at their original 20px size', async () => {
    await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    await renderBottomTabBar()
    const nav = screen.getByRole('navigation')
    const iconSizes = Array.from(
      nav.querySelectorAll<SVGElement>(
        '[data-slot="bottom-navigation-icon"] > svg',
      ),
      (icon) => {
        const { width, height } = icon.getBoundingClientRect()
        return { width, height }
      },
    )

    expect(iconSizes).toEqual([
      { width: 20, height: 20 },
      { width: 20, height: 20 },
      { width: 20, height: 20 },
      { width: 20, height: 20 },
      { width: 20, height: 20 },
      { width: 20, height: 20 },
    ])
  })

  it('keeps the search divider inset from the item edges', async () => {
    await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    await renderBottomTabBar()
    const divider = getComputedStyle(
      screen.getByRole('button', { name: 'search' }),
      '::before',
    )
    const dividerDimensions = `${divider.top}|${divider.bottom}|${divider.left}|${divider.width}`

    expect(dividerDimensions).toBe('12px|12px|0px|1px')
  })

  it('marks a nested route and preserves navigation colors', async () => {
    await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    await renderBottomTabBar({ currentPath: '/tasks/example' })
    const nav = screen.getByRole('navigation')
    const itemStates = Array.from(
      nav.querySelectorAll('[data-slot="bottom-navigation-item"]'),
      (item) => ({
        label: item.textContent.trim(),
        current: item.getAttribute('aria-current'),
        selectedBorder: item.classList.contains('border-t-primary'),
        selectedText: item.classList.contains('text-foreground'),
        mutedText: item.classList.contains('text-muted-foreground'),
        faintText: item.classList.contains('text-muted-foreground-faint'),
        destructiveHover: item.classList.contains('hover:text-destructive'),
      }),
    )

    expect(itemStates).toEqual([
      {
        label: 'browse',
        current: null,
        selectedBorder: false,
        selectedText: false,
        mutedText: false,
        faintText: true,
        destructiveHover: false,
      },
      {
        label: 'today',
        current: null,
        selectedBorder: false,
        selectedText: false,
        mutedText: false,
        faintText: true,
        destructiveHover: false,
      },
      {
        label: 'calendar',
        current: null,
        selectedBorder: false,
        selectedText: false,
        mutedText: false,
        faintText: true,
        destructiveHover: false,
      },
      {
        label: 'tasks',
        current: 'page',
        selectedBorder: true,
        selectedText: true,
        mutedText: false,
        faintText: false,
        destructiveHover: false,
      },
      {
        label: 'search',
        current: null,
        selectedBorder: false,
        selectedText: false,
        mutedText: true,
        faintText: false,
        destructiveHover: true,
      },
      {
        label: 'new',
        current: null,
        selectedBorder: false,
        selectedText: false,
        mutedText: true,
        faintText: false,
        destructiveHover: true,
      },
    ])
  })

  it('matches the calendar tab only on the home route', async () => {
    await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    await renderBottomTabBar({ currentPath: '/' })
    const nav = screen.getByRole('navigation')
    const currentItems = Array.from(
      nav.querySelectorAll('[data-slot="bottom-navigation-item"]'),
      (item) => ({
        label: item.textContent.trim(),
        current: item.getAttribute('aria-current'),
      }),
    )

    expect(currentItems).toEqual([
      { label: 'browse', current: null },
      { label: 'today', current: null },
      { label: 'calendar', current: 'page' },
      { label: 'tasks', current: null },
      { label: 'search', current: null },
      { label: 'new', current: null },
    ])
  })

  it('keeps all six items in one row without overlap and scrolls focused items into view', async () => {
    await page.viewport(280, 640)
    await renderBottomTabBar()
    const nav = screen.getByRole('navigation')
    expect(await readNavigationLayout(nav)).toEqual({
      labels: ['browse', 'today', 'calendar', 'tasks', 'search', 'new'],
      oneRow: true,
      noOverlap: true,
      labelsStayOnOneLine: true,
      overflowsHorizontally: true,
      focusScrolls: true,
      lastItemVisible: true,
    })
  })

  it('calls onSearch when the search action is clicked', async () => {
    await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    const actions: string[] = []
    await renderBottomTabBar({
      onSearch: () => {
        actions.push('search')
      },
      onNewTask: () => {},
    })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'search' }))

    expect(actions).toEqual(['search'])
  })

  it('calls onNewTask when the new action is clicked', async () => {
    await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    const actions: string[] = []
    await renderBottomTabBar({
      onSearch: () => {},
      onNewTask: () => {
        actions.push('new')
      },
    })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'new' }))

    expect(actions).toEqual(['new'])
  })
})
