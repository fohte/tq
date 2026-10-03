import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import { makeGithubLink } from '#components/task/github-link-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import {
  GITHUB_URL_FIXTURE,
  GITHUB_URL_FIXTURE_TITLE,
  MENTION_FIXTURE_NUMBER,
  MENTION_FIXTURE_TASK_ID,
  MENTION_FIXTURE_TITLE,
  seedLiveReferenceFixtures,
} from '#components/ui/markdown-editor-live-references-test-fixtures'
import { githubUrlPreviewKeys } from '#hooks/use-github-url-preview'
import { assertDefined, findEditorText } from '#lib/test-utils'
import { createStoryRouter } from '#storybook-config/story-router'

const LINKED_GITHUB_URL_FIXTURE = 'https://github.com/fohte/tq/issues/9104'
const UNSUPPORTED_SERVICE_URL =
  'https://example.slack.com/archives/CTEST1234/p1234567890123456'
const LINKED_TASK_LINK_TEXT = 'Linked to a TQ task →'
const OUTSIDE_CARD_TEXT = 'A plain paragraph outside any card.'

function getControlledNavigationState(
  wrapper: Element,
  editingChanges: string[],
  pathname: string,
) {
  return {
    mode: wrapper.getAttribute('data-view-mode'),
    editingChanges,
    pathname,
  }
}

function getViewModeAndChanges(wrapper: Element, editingChanges: string[]) {
  return {
    mode: wrapper.getAttribute('data-view-mode'),
    editingChanges,
  }
}

function getChipClickState(
  wrapper: Element,
  editingChanges: string[],
  chipVisible: boolean,
) {
  return { ...getViewModeAndChanges(wrapper, editingChanges), chipVisible }
}

function getLinkClickState(
  wrapper: Element,
  link: HTMLElement,
  dispatchResult: boolean,
  defaultPrevented: boolean,
) {
  return {
    dispatchResult,
    defaultPrevented,
    mode: wrapper.getAttribute('data-view-mode'),
    linkIsContentEditable: link.isContentEditable,
  }
}

function getPlainLinkRendering(container: HTMLElement, link: HTMLElement) {
  return {
    inlineReferenceCount: container.querySelectorAll('.inline-reference-chip')
      .length,
    href: link.getAttribute('href'),
    label: link.textContent,
  }
}

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
// plugin.tsx), so they need a QueryClientProvider and router ancestor here
// the same way the app's real root provides them.
function renderWithProviders(
  ui: ReactNode,
  seed?: (queryClient: QueryClient) => void,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  seed?.(queryClient)

  const router = createStoryRouter({
    component: () => <>{ui}</>,
    paths: ['/tasks/$taskId'],
  })
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
    router,
  }
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
        editing={false}
        onEditingChange={() => {}}
      />,
      seedLiveReferenceFixtures,
    )

    await expect(findEditorText(MENTION_FIXTURE_TITLE)).resolves.toBeVisible()
    await expect(
      findEditorText(GITHUB_URL_FIXTURE_TITLE),
    ).resolves.toBeVisible()
  })

  it('keeps the chip and view mode when the caller has not opened editing', async () => {
    const editingChanges: string[] = []
    const { container } = renderWithProviders(
      <MarkdownEditor
        defaultValue={`See #${String(MENTION_FIXTURE_NUMBER)} for details.`}
        editing={false}
        onEditingChange={(editing) => editingChanges.push(String(editing))}
      />,
      seedLiveReferenceFixtures,
    )
    await findEditorText(MENTION_FIXTURE_TITLE)
    const wrapper = assertDefined(
      container.querySelector('.milkdown-wrapper'),
      'MarkdownEditor always renders its wrapper',
    )
    const paragraph = assertDefined(
      container.querySelector('.milkdown .ProseMirror p'),
      'editor always renders a paragraph',
    )

    const user = userEvent.setup()
    await user.click(paragraph)

    expect(
      getChipClickState(
        wrapper,
        editingChanges,
        screen.queryByText(MENTION_FIXTURE_TITLE) != null,
      ),
    ).toEqual({
      mode: 'view',
      editingChanges: [],
      chipVisible: true,
    })
  })

  it('keeps view mode when clicking reference cards and plain text', async () => {
    const editingChanges: string[] = []
    const { container } = renderWithProviders(
      <MarkdownEditor
        defaultValue={`#${String(MENTION_FIXTURE_NUMBER)}\n\n${LINKED_GITHUB_URL_FIXTURE}\n\n${OUTSIDE_CARD_TEXT}`}
        editing={false}
        onEditingChange={(editing) => editingChanges.push(String(editing))}
      />,
      (queryClient) => {
        seedLiveReferenceFixtures(queryClient)
        seedLinkedGithubUrlFixture(queryClient)
      },
    )

    await findEditorText(MENTION_FIXTURE_TITLE)
    await findEditorText(LINKED_TASK_LINK_TEXT)
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

    // Plain text follows the same controlled view state as reference cards.
    await user.click(screen.getByText(OUTSIDE_CARD_TEXT))
    expect(getViewModeAndChanges(wrapper, editingChanges)).toEqual({
      mode: 'view',
      editingChanges: [],
    })
  })

  const MARKDOWN_LINK_TEXT = 'a plain markdown link'
  const MARKDOWN_LINK_HASH = '#markdown-link-target'

  // A bare Markdown link remains visible and does not request an edit-mode
  // transition when its mouse button is released.
  it('keeps view mode when clicking a bare markdown link', async () => {
    const { container } = renderWithProviders(
      <MarkdownEditor
        defaultValue={`[${MARKDOWN_LINK_TEXT}](${MARKDOWN_LINK_HASH})\n\n${OUTSIDE_CARD_TEXT}`}
        editing={false}
        onEditingChange={() => {}}
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
    let defaultPrevented = false
    link.addEventListener('click', (event) => {
      defaultPrevented = event.defaultPrevented
    })
    const dispatchResult = fireEvent.click(link)

    expect(
      getLinkClickState(wrapper, link, dispatchResult, defaultPrevented),
    ).toEqual({
      dispatchResult: true,
      defaultPrevented: false,
      mode: 'view',
      linkIsContentEditable: false,
    })
  })

  it('renders an unsupported service permalink as a plain link', async () => {
    const { container } = renderWithProviders(
      <MarkdownEditor
        defaultValue={UNSUPPORTED_SERVICE_URL}
        editing={false}
        onEditingChange={() => {}}
      />,
    )

    const link = await screen.findByRole('link', {
      name: UNSUPPORTED_SERVICE_URL,
    })

    expect(getPlainLinkRendering(container, link)).toEqual({
      inlineReferenceCount: 0,
      href: UNSUPPORTED_SERVICE_URL,
      label: UNSUPPORTED_SERVICE_URL,
    })
  })

  it('navigates through an inline task chip while editing is controlled', async () => {
    const editingChanges: string[] = []
    const { container, router } = renderWithProviders(
      <MarkdownEditor
        defaultValue={`See #${String(MENTION_FIXTURE_NUMBER)} for details.`}
        editing={false}
        onEditingChange={(editing) => editingChanges.push(String(editing))}
      />,
      seedLiveReferenceFixtures,
    )

    await findEditorText(MENTION_FIXTURE_TITLE)
    const user = userEvent.setup()
    const chip = screen.getByText(MENTION_FIXTURE_TITLE)
    await user.hover(chip)
    const taskLink = await screen.findByRole('link')
    const wrapper = assertDefined(
      container.querySelector('.milkdown-wrapper'),
      'MarkdownEditor always renders its wrapper',
    )
    await user.click(taskLink)

    expect(
      getControlledNavigationState(
        wrapper,
        editingChanges,
        router.state.location.pathname,
      ),
    ).toEqual({
      mode: 'view',
      editingChanges: [],
      pathname: `/tasks/${MENTION_FIXTURE_TASK_ID}`,
    })
  })

  const UNSAFE_SCHEME_LINK_TEXT = 'a javascript: link'

  it('keeps executable Markdown links inert in view mode', async () => {
    const { container } = renderWithProviders(
      <MarkdownEditor
        defaultValue={`[${UNSAFE_SCHEME_LINK_TEXT}](javascript:alert(1))`}
        editing={false}
        onEditingChange={() => {}}
      />,
    )

    const link = await screen.findByRole('link', {
      name: UNSAFE_SCHEME_LINK_TEXT,
    })
    const wrapper = assertDefined(
      container.querySelector('.milkdown-wrapper'),
      'MarkdownEditor always renders its wrapper',
    )
    let defaultPrevented = false
    link.addEventListener('click', (event) => {
      defaultPrevented = event.defaultPrevented
    })
    const dispatchResult = fireEvent.click(link)

    expect(
      getLinkClickState(wrapper, link, dispatchResult, defaultPrevented),
    ).toEqual({
      dispatchResult: false,
      defaultPrevented: true,
      mode: 'view',
      linkIsContentEditable: false,
    })
  })
})
