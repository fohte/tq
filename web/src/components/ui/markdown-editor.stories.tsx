import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { expect, fireEvent, fn } from 'storybook/test'

import { MarkdownEditor } from '#components/ui/markdown-editor'
import { githubUrlPreviewKeys } from '#hooks/use-github-url-preview'
import { taskMentionKeys } from '#hooks/use-task-mentions'
import type { TaskDetail } from '#hooks/use-tasks'
import { queryClient } from '#lib/query-client'

const meta = {
  title: 'UI/MarkdownEditor',
  component: MarkdownEditor,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="min-h-[400px] w-[600px] border border-border bg-card p-2.5 text-sm">
        <Story />
      </div>
    ),
  ],
  args: {
    onChange: fn(),
  },
} satisfies Meta<typeof MarkdownEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    placeholder: 'Write something...',
  },
}

export const WithContent: Story = {
  args: {
    defaultValue:
      '## Discussion Points\n\n- Architecture review\n- Sprint planning\n- Performance improvements\n\nWe decided to go with option B for the following reasons:\n\n1. Better performance\n2. Simpler architecture\n3. Easier to maintain',
  },
}

const MENTION_FIXTURE_NUMBER = 9101
const GITHUB_URL_FIXTURE = 'https://github.com/fohte/tq/issues/9102'
const MENTION_FIXTURE_TITLE = 'Investigate flaky auth test suite'
const GITHUB_URL_FIXTURE_TITLE =
  'Support live-preview chips and autocomplete for task mentions'

// Seeds the app-wide query cache the decoration plugin's chips render
// through (see plugin.tsx's `createChipWidgetComponent`), so both providers
// resolve their chip synchronously instead of via a real network round-trip.
function seedLiveReferenceFixtures() {
  const task: TaskDetail = {
    id: '00000000-0000-0000-0000-000000000099',
    number: MENTION_FIXTURE_NUMBER,
    title: MENTION_FIXTURE_TITLE,
    description: null,
    status: 'todo',
    context: 'personal',
    labels: [],
    startDate: null,
    dueDate: null,
    estimatedMinutes: null,
    parentId: null,
    projectId: null,
    recurrenceRuleId: null,
    recurrenceRule: null,
    githubLink: null,
    sortOrder: 0,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    titleAuthor: null,
    descriptionAuthor: null,
    childCompletionCount: { completed: 0, total: 0 },
    pages: [],
    timeBlocks: [],
    links: { outgoing: [], incoming: [] },
  }
  queryClient.setQueryData(
    taskMentionKeys.preview(MENTION_FIXTURE_NUMBER),
    task,
  )

  queryClient.setQueryData(githubUrlPreviewKeys.preview(GITHUB_URL_FIXTURE), {
    linked: false,
    preview: {
      owner: 'fohte',
      repo: 'tq',
      number: 9102,
      kind: 'issue',
      url: GITHUB_URL_FIXTURE,
      title: GITHUB_URL_FIXTURE_TITLE,
      body: null,
      state: 'open',
    },
  })
}

// Chips render as portals into the app's own React tree (see plugin.tsx),
// so they need a QueryClientProvider and RouterProvider ancestor here the
// same way the app's real root provides them.
function LiveReferencesProviders({ children }: { children: ReactNode }) {
  const rootRoute = createRootRoute({
    component: () => <>{children}</>,
  })
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

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

// Exercises the real Crepe editor end to end (not just the plugin mechanism
// or an isolated Chip component): markdown parsing, both InlineReference
// providers scanning the same textblock, and their chips coexisting without
// interfering with each other. `viewEditToggle` is required for chips to
// render at all — an always-editable editor (no `viewEditToggle`, e.g.
// CommentInput) stays in 'edit' mode and only ever shows raw Markdown
// source (see markdown-editor.tsx's CrepeEditorProps.mode comment).
export const WithLiveReferences: Story = {
  render: (args) => {
    seedLiveReferenceFixtures()
    return (
      <LiveReferencesProviders>
        <MarkdownEditor {...args} />
      </LiveReferencesProviders>
    )
  },
  args: {
    defaultValue: `See #${String(MENTION_FIXTURE_NUMBER)} and ${GITHUB_URL_FIXTURE} for details.`,
    viewEditToggle: {},
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.findByText(MENTION_FIXTURE_TITLE),
    ).resolves.toBeVisible()
    await expect(
      canvas.findByText(GITHUB_URL_FIXTURE_TITLE),
    ).resolves.toBeVisible()
  },
}

// Clicking anywhere in the read-only view switches to edit mode: chips
// disappear and the raw Markdown source they were hiding becomes visible
// instead. Clicks land on the paragraph itself rather than on the chip, since
// hovering the chip opens its own preview popup that would otherwise
// intercept the click.
export const ClickToEditRevealsSource: Story = {
  render: (args) => {
    seedLiveReferenceFixtures()
    return (
      <LiveReferencesProviders>
        <MarkdownEditor {...args} />
      </LiveReferencesProviders>
    )
  },
  args: {
    defaultValue: `See #${String(MENTION_FIXTURE_NUMBER)} for details.`,
    viewEditToggle: {},
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await canvas.findByText(MENTION_FIXTURE_TITLE)
    const paragraph = canvasElement.querySelector('.milkdown .ProseMirror p')
    if (paragraph == null) throw new Error('editor always renders a paragraph')

    await userEvent.click(paragraph)

    await expect(
      canvas.findByText(new RegExp(`#${String(MENTION_FIXTURE_NUMBER)}`)),
    ).resolves.toBeVisible()
    await expect(
      canvas.queryByText(MENTION_FIXTURE_TITLE),
    ).not.toBeInTheDocument()
  },
}

const TRAILING_BLOCKQUOTE_CONTENT =
  'Some intro text.\n\n> A blockquote at the very end.'

// Regression test: switching view<->edit mode with zero typing must never
// mutate the document. Content ending in a blockquote (rather than a
// paragraph/heading) is what exposes this: Milkdown's built-in `trailing`
// plugin (@milkdown/plugin-trailing) appends an empty paragraph via
// `appendTransaction` whenever ANY transaction is dispatched while the doc
// doesn't already end in a paragraph/heading — regardless of whether that
// transaction itself changed anything. A content ending in a *list* doesn't
// reproduce this: Crepe's list-item node view dispatches its own
// content-neutral selection-sync transaction the moment the editor mounts,
// which already closes this same gap before a user ever clicks.
//
// The block count is the assertion that actually distinguishes buggy from
// fixed behavior here. `onChange` is also asserted for completeness, but
// this project's Storybook/VRT setup pins the system clock
// (.storybook/vitest.setup.ts), which starves Milkdown's `markdownUpdated`
// listener of real elapsed time (it debounces via lodash, which reads
// `Date.now()`) — so `onChange` never fires in this environment regardless
// of whether the underlying bug is present.
export const SwitchingModeWithoutEditingDoesNotAutosave: Story = {
  args: {
    defaultValue: TRAILING_BLOCKQUOTE_CONTENT,
    viewEditToggle: {},
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const wrapper = canvasElement.querySelector('.milkdown-wrapper')
    const proseMirrorRoot = canvasElement.querySelector(
      '.milkdown .ProseMirror',
    )
    if (wrapper == null || proseMirrorRoot == null)
      throw new Error('MarkdownEditor always renders its wrapper and root')
    const blockquote = canvasElement.querySelector(
      '.milkdown .ProseMirror blockquote',
    )
    if (blockquote == null)
      throw new Error('editor always renders the blockquote')

    const blockCountBefore = proseMirrorRoot.children.length

    // view -> edit, zero typing
    await userEvent.click(blockquote)
    await expect(wrapper).toHaveAttribute('data-view-mode', 'edit')

    // edit -> view, zero typing. `fireEvent` (not `userEvent.keyboard`)
    // targets the wrapper directly: the click above flips the editor into
    // edit mode, but Crepe only applies `contenteditable=true` in a React
    // effect that runs after that click event has already finished, so the
    // browser never focuses the (still read-only at click time) DOM node —
    // there'd be nothing for a keyboard-targeted Escape to bubble up from.
    await fireEvent.keyDown(wrapper, { key: 'Escape' })
    await expect(wrapper).toHaveAttribute('data-view-mode', 'view')

    await expect(proseMirrorRoot.children.length).toBe(blockCountBefore)
    await expect(args.onChange).not.toHaveBeenCalled()
  },
}

// Companion to the regression test above: a real edit must still reach the
// document (the fix must not also swallow legitimate changes). Typing a
// second click into the blockquote first: the first click flips the editor
// into edit mode, but Crepe only applies `contenteditable=true` in a React
// effect that runs after that click event has already finished, so the
// browser never focuses the (still read-only at click time) DOM node — a
// second click, now that it's actually editable, gives it real focus so the
// following keystroke lands in the document.
export const TypingAfterEnteringEditModeChangesDocument: Story = {
  args: {
    defaultValue: TRAILING_BLOCKQUOTE_CONTENT,
    viewEditToggle: {},
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const wrapper = canvasElement.querySelector('.milkdown-wrapper')
    if (wrapper == null)
      throw new Error('MarkdownEditor always renders its wrapper')
    const blockquote = canvasElement.querySelector(
      '.milkdown .ProseMirror blockquote',
    )
    if (blockquote == null)
      throw new Error('editor always renders the blockquote')

    await userEvent.click(blockquote)
    await userEvent.click(blockquote)
    await userEvent.keyboard('!')

    await expect(
      canvas.findByText('A blockquote at the very end.!'),
    ).resolves.toBeVisible()

    await userEvent.keyboard('{Escape}')
    await expect(wrapper).toHaveAttribute('data-view-mode', 'view')
    await expect(
      canvas.findByText('A blockquote at the very end.!'),
    ).resolves.toBeVisible()
  },
}

const LINKED_GITHUB_URL_FIXTURE = 'https://github.com/fohte/tq/issues/9104'
const LINKED_TASK_LINK_TEXT = 'Linked to a TQ task →'
const OUTSIDE_CARD_TEXT = 'A plain paragraph outside any card.'

// Seeds a GitHub URL preview already linked to a TQ task, so GithubUrlCard
// renders its nested "Linked to a TQ task" router `Link` in addition to its
// plain `<a>` — combined with seedLiveReferenceFixtures' task-mention card
// (whose whole clickable area IS a router `Link`), this covers every `Link`
// a card can render.
function seedLinkedGithubUrlFixture() {
  queryClient.setQueryData(
    githubUrlPreviewKeys.preview(LINKED_GITHUB_URL_FIXTURE),
    {
      linked: true,
      task: {
        id: '00000000-0000-0000-0000-000000000098',
        number: 7,
        title: 'Fix flaky test',
        description: null,
        status: 'in_progress',
        context: 'personal',
        startDate: null,
        dueDate: null,
        estimatedMinutes: null,
        parentId: null,
        projectId: null,
        recurrenceRuleId: null,
        recurrenceRule: null,
        githubLink: {
          id: 'link-1',
          owner: 'fohte',
          repo: 'tq',
          number: 9104,
          kind: 'issue',
          url: LINKED_GITHUB_URL_FIXTURE,
          state: 'open',
          title: 'Fix flaky test',
          lastSyncedAt: '2026-03-20T00:00:00.000Z',
        },
        sortOrder: 0,
        createdAt: '2026-03-20T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z',
      },
    },
  )
}

// Cards must stay clickable without ever flipping the editor into edit mode
// (see plugin.tsx's createCardWidgetComponent and the per-element
// `onMouseUp` stopPropagation in github-url-card.tsx/task-mention-card.tsx).
// This is the one place that exercises the full chain for real: a real
// mouseup dispatched by userEvent.click, bubbling from an actual rendered
// card through an actual rendered MarkdownEditor — unlike plugin.test.ts
// (decoration-building logic in isolation) or the cards' own stories
// (render/fallback only, not click-safety).
export const ClickingCardStaysInViewMode: Story = {
  render: (args) => {
    seedLiveReferenceFixtures()
    seedLinkedGithubUrlFixture()
    return (
      <LiveReferencesProviders>
        <MarkdownEditor {...args} />
      </LiveReferencesProviders>
    )
  },
  args: {
    defaultValue: `#${String(MENTION_FIXTURE_NUMBER)}\n\n${LINKED_GITHUB_URL_FIXTURE}\n\n${OUTSIDE_CARD_TEXT}`,
    viewEditToggle: {},
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const wrapper = canvasElement.querySelector('.milkdown-wrapper')
    if (wrapper == null)
      throw new Error('MarkdownEditor always renders its wrapper')

    await canvas.findByText(MENTION_FIXTURE_TITLE)
    await canvas.findByText(LINKED_TASK_LINK_TEXT)
    await expect(wrapper).toHaveAttribute('data-view-mode', 'view')

    // The task-mention card's whole clickable area is a router `Link`.
    await userEvent.click(canvas.getByText(MENTION_FIXTURE_TITLE))
    await expect(wrapper).toHaveAttribute('data-view-mode', 'view')

    // GithubUrlCard's "Linked to a TQ task" line is a router `Link` nested
    // inside the card, separate from the card's own plain `<a>`.
    await userEvent.click(canvas.getByText(LINKED_TASK_LINK_TEXT))
    await expect(wrapper).toHaveAttribute('data-view-mode', 'view')

    // Control: clicking plain text outside any card must still flip the
    // editor into edit mode, proving the two assertions above are actually
    // capable of detecting a mode switch (not a false negative from a
    // selector that can never observe it).
    await userEvent.click(canvas.getByText(OUTSIDE_CARD_TEXT))
    await expect(wrapper).toHaveAttribute('data-view-mode', 'edit')
  },
}
