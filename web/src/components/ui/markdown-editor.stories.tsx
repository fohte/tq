import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'

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
      <div className="min-h-[400px] w-[600px] text-sm">
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
// through (see plugin.tsx's `createChipWidget`), so both providers resolve
// their chip synchronously instead of via a real network round-trip.
function seedLiveReferenceFixtures() {
  const task: TaskDetail = {
    id: '00000000-0000-0000-0000-000000000099',
    number: MENTION_FIXTURE_NUMBER,
    title: MENTION_FIXTURE_TITLE,
    description: null,
    status: 'todo',
    context: 'dev',
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

// Exercises the real Crepe editor end to end (not just the plugin mechanism
// or an isolated Chip component): markdown parsing, both InlineReference
// providers scanning the same textblock, and their chips coexisting without
// interfering with each other.
export const WithLiveReferences: Story = {
  render: (args) => {
    seedLiveReferenceFixtures()
    return <MarkdownEditor {...args} />
  },
  args: {
    defaultValue: `See #${String(MENTION_FIXTURE_NUMBER)} and ${GITHUB_URL_FIXTURE} for details.`,
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
