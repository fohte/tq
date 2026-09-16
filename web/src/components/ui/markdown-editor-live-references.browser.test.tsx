import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import {
  makeGithubLink,
  makeResolveGithubUrlResult,
} from '#components/task/github-link-test-fixtures'
import {
  makeTask,
  makeTaskDetail,
} from '#components/task/task-row-test-fixtures'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import { githubUrlPreviewKeys } from '#hooks/use-github-url-preview'
import { taskMentionKeys } from '#hooks/use-task-mentions'
import { assertDefined } from '#lib/test-utils'

const MENTION_FIXTURE_NUMBER = 9101
const GITHUB_URL_FIXTURE = 'https://github.com/fohte/tq/issues/9102'
const MENTION_FIXTURE_TITLE = 'Investigate flaky auth test suite'
const GITHUB_URL_FIXTURE_TITLE =
  'Support live-preview chips and autocomplete for task mentions'

// Seeds the query cache the decoration plugin's chips render through (see
// plugin.tsx's `createChipWidgetComponent`), so both providers resolve their
// chip synchronously instead of via a real network round-trip.
function seedLiveReferenceFixtures(queryClient: QueryClient) {
  const task = makeTaskDetail({
    id: '00000000-0000-0000-0000-000000000099',
    number: MENTION_FIXTURE_NUMBER,
    title: MENTION_FIXTURE_TITLE,
    description: null,
    startDate: null,
    dueDate: null,
    estimatedMinutes: null,
  })
  queryClient.setQueryData(
    taskMentionKeys.preview(MENTION_FIXTURE_NUMBER),
    task,
  )

  queryClient.setQueryData(
    githubUrlPreviewKeys.preview(GITHUB_URL_FIXTURE),
    makeResolveGithubUrlResult({
      number: 9102,
      url: GITHUB_URL_FIXTURE,
      title: GITHUB_URL_FIXTURE_TITLE,
    }),
  )
}

const LINKED_GITHUB_URL_FIXTURE = 'https://github.com/fohte/tq/issues/9104'
const LINKED_TASK_LINK_TEXT = 'Linked to a TQ task →'
const OUTSIDE_CARD_TEXT = 'A plain paragraph outside any card.'

// Seeds a GitHub URL preview already linked to a TQ task, so GithubUrlCard
// renders its nested "Linked to a TQ task" router `Link` in addition to its
// plain `<a>` — combined with seedLiveReferenceFixtures' task-mention card
// (whose whole clickable area IS a router `Link`), this covers every `Link`
// a card can render.
function seedLinkedGithubUrlFixture(queryClient: QueryClient) {
  queryClient.setQueryData(
    githubUrlPreviewKeys.preview(LINKED_GITHUB_URL_FIXTURE),
    {
      linked: true,
      task: makeTask({
        id: '00000000-0000-0000-0000-000000000098',
        number: 7,
        title: 'Fix flaky test',
        githubLinks: [
          makeGithubLink({
            id: 'link-1',
            number: 9104,
            url: LINKED_GITHUB_URL_FIXTURE,
            title: 'Fix flaky test',
          }),
        ],
      }),
    },
  )
}

// Chips/cards render as portals into the app's own React tree (see
// plugin.tsx), so they need a QueryClientProvider and RouterProvider
// ancestor here the same way the app's real root provides them.
function renderWithProviders(
  ui: ReactNode,
  seed?: (queryClient: QueryClient) => void,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  seed?.(queryClient)

  const rootRoute = createRootRoute({ component: () => ui })
  const taskRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId',
    component: () => null,
  })
  rootRoute.addChildren([taskRoute])
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('MarkdownEditor live references', () => {
  // Exercises the real Crepe editor end to end (not just the plugin
  // mechanism or an isolated Chip component): markdown parsing, both
  // InlineReference providers scanning the same textblock, and their chips
  // coexisting without interfering with each other.
  it('renders task mention and GitHub URL references together', async () => {
    renderWithProviders(
      <MarkdownEditor
        defaultValue={`See #${String(MENTION_FIXTURE_NUMBER)} and ${GITHUB_URL_FIXTURE} for details.`}
        viewEditToggle={{}}
      />,
      seedLiveReferenceFixtures,
    )

    await expect(
      screen.findByText(MENTION_FIXTURE_TITLE),
    ).resolves.toBeVisible()
    await expect(
      screen.findByText(GITHUB_URL_FIXTURE_TITLE),
    ).resolves.toBeVisible()
  })

  // Cards must stay clickable without ever flipping the editor into edit
  // mode (see plugin.tsx's createCardWidgetComponent and the per-element
  // `onMouseUp` stopPropagation in github-url-card.tsx/task-mention-card.tsx).
  it('keeps view mode when clicking a task-mention or linked-GitHub card, but flips to edit mode for plain text', async () => {
    const { container } = renderWithProviders(
      <MarkdownEditor
        defaultValue={`#${String(MENTION_FIXTURE_NUMBER)}\n\n${LINKED_GITHUB_URL_FIXTURE}\n\n${OUTSIDE_CARD_TEXT}`}
        viewEditToggle={{}}
      />,
      (queryClient) => {
        seedLiveReferenceFixtures(queryClient)
        seedLinkedGithubUrlFixture(queryClient)
      },
    )

    await screen.findByText(MENTION_FIXTURE_TITLE)
    await screen.findByText(LINKED_TASK_LINK_TEXT)
    const wrapper = assertDefined(
      container.querySelector('.milkdown-wrapper'),
      'MarkdownEditor always renders its wrapper',
    )
    expect(wrapper).toHaveAttribute('data-view-mode', 'view')

    const user = userEvent.setup()

    // The task-mention card's whole clickable area is a router `Link`.
    await user.click(screen.getByText(MENTION_FIXTURE_TITLE))
    expect(wrapper).toHaveAttribute('data-view-mode', 'view')

    // GithubUrlCard's "Linked to a TQ task" line is a router `Link` nested
    // inside the card, separate from the card's own plain `<a>`.
    await user.click(screen.getByText(LINKED_TASK_LINK_TEXT))
    expect(wrapper).toHaveAttribute('data-view-mode', 'view')

    // Control: clicking plain text outside any card must still flip the
    // editor into edit mode, proving the two assertions above are actually
    // capable of detecting a mode switch (not a false negative from a
    // selector that can never observe it).
    await user.click(screen.getByText(OUTSIDE_CARD_TEXT))
    expect(wrapper).toHaveAttribute('data-view-mode', 'edit')
  })

  const MARKDOWN_LINK_TEXT = 'a plain markdown link'
  const MARKDOWN_LINK_HASH = '#markdown-link-target'

  // A bare Markdown link (as opposed to an inline-reference chip/card) must
  // stay clickable in view mode too: clicking it should navigate, not flip
  // the editor into edit mode. See markdown-editor.tsx's onMouseUp guard.
  it('keeps view mode when clicking a bare markdown link', async () => {
    const { container } = renderWithProviders(
      <MarkdownEditor
        defaultValue={`[${MARKDOWN_LINK_TEXT}](${MARKDOWN_LINK_HASH})\n\n${OUTSIDE_CARD_TEXT}`}
        viewEditToggle={{}}
      />,
    )

    // fireEvent dispatches straight at the element instead of hit-testing
    // screen coordinates like userEvent.click does — Milkdown's hidden
    // link-tooltip preview UI overlaps the link's coordinates even while
    // closed, which made userEvent.click land on the tooltip instead of the
    // link itself.
    const link = await screen.findByRole('link', { name: MARKDOWN_LINK_TEXT })
    const wrapper = assertDefined(
      container.querySelector('.milkdown-wrapper'),
      'MarkdownEditor always renders its wrapper',
    )
    fireEvent.mouseUp(link, { button: 0 })

    expect(wrapper).toHaveAttribute('data-view-mode', 'view')
    // The point of this test: readonly must stay true past onMouseUp so a
    // real click that follows still hits a non-editable <a> and navigates (a
    // contenteditable one loses the browser's default click-through).
    expect(link.isContentEditable).toBe(false)

    // Control: clicking plain text outside the link must still flip the
    // editor into edit mode, proving the assertion above is actually capable
    // of detecting a mode switch.
    fireEvent.mouseUp(screen.getByText(OUTSIDE_CARD_TEXT), { button: 0 })
    expect(wrapper).toHaveAttribute('data-view-mode', 'edit')
  })

  const UNSAFE_SCHEME_LINK_TEXT = 'a javascript: link'

  // Regression check: a Markdown link's href is unfiltered user content, so
  // an executable scheme like `javascript:` must NOT get the click-through
  // treatment above — it has to keep flipping the editor into edit mode
  // (never becoming clickable) or clicking it would run arbitrary script.
  // See markdown-editor.tsx's NAVIGABLE_LINK_PROTOCOLS.
  it('enters edit mode when clicking an unsafe-scheme link', async () => {
    const { container } = renderWithProviders(
      <MarkdownEditor
        defaultValue={`[${UNSAFE_SCHEME_LINK_TEXT}](javascript:alert(1))`}
        viewEditToggle={{}}
      />,
    )

    const link = await screen.findByRole('link', {
      name: UNSAFE_SCHEME_LINK_TEXT,
    })
    const wrapper = assertDefined(
      container.querySelector('.milkdown-wrapper'),
      'MarkdownEditor always renders its wrapper',
    )
    fireEvent.mouseUp(link, { button: 0 })

    expect(wrapper).toHaveAttribute('data-view-mode', 'edit')
  })
})
