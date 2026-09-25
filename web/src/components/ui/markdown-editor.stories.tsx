import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ComponentProps, ReactNode } from 'react'
import { fn } from 'storybook/test'

import { MarkdownEditor } from '#components/ui/markdown-editor'
import {
  GITHUB_URL_FIXTURE,
  MENTION_FIXTURE_NUMBER,
  seedLiveReferenceFixtures,
} from '#components/ui/markdown-editor-live-references-test-fixtures'
import { queryClient } from '#lib/query-client'
import { StoryRouter } from '#storybook-config/story-router'

const meta = {
  title: 'UI/MarkdownEditor',
  component: MarkdownEditor,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl border border-border bg-card p-2.5 text-sm">
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
  name: 'shows an empty editor with its placeholder',
  args: {
    placeholder: 'Write something...',
  },
}

export const WithContent: Story = {
  name: 'shows formatted discussion notes in the editor',
  args: {
    defaultValue:
      '## Discussion Points\n\n- Architecture review\n- Sprint planning\n- Performance improvements\n\nWe decided to go with option B for the following reasons:\n\n1. Better performance\n2. Simpler architecture\n3. Easier to maintain',
  },
}

// Regression check: 'compact' (a few-lines inline editor, e.g. a task/project
// description) must render its own min-height (120px) rather than the
// 'default' size's 400px or collapsing to the content's own height.
export const Compact: Story = {
  name: 'shows a compact editor for a short description',
  args: {
    placeholder: 'Write something...',
    size: 'compact',
  },
}

// Chips render as portals into the app's own React tree (see plugin.tsx),
// so they need a QueryClientProvider and RouterProvider ancestor here the
// same way the app's real root provides them.
function LiveReferencesProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId']}
      />
    </QueryClientProvider>
  )
}

function renderWithLiveReferences(args: ComponentProps<typeof MarkdownEditor>) {
  seedLiveReferenceFixtures(queryClient)
  return (
    <LiveReferencesProviders>
      <MarkdownEditor {...args} />
    </LiveReferencesProviders>
  )
}

// Exercises the real Crepe editor end to end (not just the plugin mechanism
// or an isolated Chip component): markdown parsing, both InlineReference
// providers scanning the same textblock, and their chips coexisting without
// interfering with each other. `viewEditToggle` is required for chips to
// render at all — an always-editable editor (no `viewEditToggle`, e.g.
// CommentInput) stays in 'edit' mode and only ever shows raw Markdown
// source (see markdown-editor-crepe.tsx's CrepeEditorProps.mode comment).
export const WithLiveReferences: Story = {
  name: 'renders a task mention and GitHub URL as live chips',
  render: renderWithLiveReferences,
  args: {
    defaultValue: `See #${String(MENTION_FIXTURE_NUMBER)} and ${GITHUB_URL_FIXTURE} for details.`,
    viewEditToggle: {},
  },
}

// h1, h3, inline code, and a plain link never appear in any other story in
// this file. The task mention renders as a chip in view mode but as its raw
// `#9101` source in edit mode, so it's included to make the two stories
// below visually distinct.
const ALL_MARKDOWN_ELEMENTS_CONTENT = `# Heading 1

## Heading 2

### Heading 3

First paragraph to check body text styling and line height.

Second paragraph immediately following the first to check spacing between paragraphs.

- Bullet one
- Bullet two
- Bullet three

1. Step one
2. Step two
3. Step three

Inline \`code span\` inside a sentence, a [link to an external site](https://example.com), and a reference to #${String(MENTION_FIXTURE_NUMBER)}.

> A blockquote to check the left border and text color.

\`\`\`ts
const answer = 42
\`\`\`
`

export const AllMarkdownElementsViewMode: Story = {
  name: 'renders headings, lists, links, code, and a task mention in view mode',
  render: renderWithLiveReferences,
  args: {
    defaultValue: ALL_MARKDOWN_ELEMENTS_CONTENT,
    viewEditToggle: {},
  },
}

export const AllMarkdownElementsEditMode: Story = {
  name: 'shows headings, lists, links, and code while editing Markdown',
  render: renderWithLiveReferences,
  args: {
    defaultValue: ALL_MARKDOWN_ELEMENTS_CONTENT,
    viewEditToggle: { defaultMode: 'edit' },
  },
}
