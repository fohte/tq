import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, fn, waitFor, within } from 'storybook/test'

import { CreateTaskModal } from '#components/task/create-task-modal'
import {
  makeGithubLink,
  makeResolveGithubUrlResult,
} from '#components/task/github-link-test-fixtures'
import { makeTaskDetail } from '#components/task/task-row-test-fixtures'
import { githubUrlPreviewKeys } from '#hooks/use-github-url-preview'
import { taskMentionKeys } from '#hooks/use-task-mentions'
import { formatLocalDate } from '#lib/date-range'
import { atIndex } from '#lib/test-utils'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

// Seeds the `^N` shorthand's parent-preview lookup (`useTaskMentionPreview`)
// directly, same as task-mention-chip.stories.tsx, so stories don't depend
// on a real network round trip.
const parentOverrideQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

// useTaskMentionPreview hardcodes a 60s staleTime, so seeding this
// module-level client just once at import time lets the data go stale by
// the time a later story in this file mounts — triggering a real
// (unhandled) background refetch. Reseeding from each story's decorator
// keeps dataUpdatedAt fresh right before that story's component mounts.
function seedParentOverridePreview() {
  parentOverrideQueryClient.setQueryData(
    taskMentionKeys.preview(34),
    makeTaskDetail({ number: 34, title: 'Refactor auth module' }),
  )
  parentOverrideQueryClient.setQueryData(taskMentionKeys.preview(999), null)
}

const githubIssueUrl = 'https://github.com/fohte/tq/issues/123'

// Same reseed-per-decorator reasoning as seedParentOverridePreview above:
// useGithubUrlPreview also hardcodes a 60s staleTime.
const githubPreviewQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function seedGithubPreview() {
  githubPreviewQueryClient.setQueryData(
    githubUrlPreviewKeys.preview(githubIssueUrl),
    makeResolveGithubUrlResult({ url: githubIssueUrl, title: 'Fix login bug' }),
  )
}

const meta = {
  title: 'Task/CreateTaskModal',
  component: CreateTaskModal,
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [
        http.get('/api/labels', () => HttpResponse.json([])),
        // Typing `^N` triggers TaskTitleInput's own suggestion menu (see
        // task-title-input.stories.tsx) in addition to the parent-preview
        // lookup these stories care about; an empty list keeps that menu out
        // of the way.
        http.get('/api/tasks/mentions', () => HttpResponse.json([])),
        http.post('/api/tasks', () =>
          HttpResponse.json({
            id: 'temp-id',
            number: 1,
            title: 'temp',
            description: null,
            status: 'todo',
            context: 'personal',
            labels: [],
          }),
        ),
      ],
    },
    // The chip row (start/due date, tags, ...) is an intentional horizontal
    // scroll area (`overflow-x-auto`); which stories trip it at the
    // storybook-mobile project's 375px viewport depends on exact chip
    // content width.
    overflowCheck: { ignoreSelectors: ['.overflow-x-auto'] },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="dark h-screen bg-background">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  args: {
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof CreateTaskModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, userEvent }) => {
    // Modal renders via portal, so query the entire document body
    const body = within(canvasElement.ownerDocument.body)

    // Renders the modal title when open
    // Base-UI renders duplicate elements; check that at least one is visible
    // The dialog content mounts into the portal asynchronously
    const titles = await body.findAllByText('New Task')
    await expect(titles.length).toBeGreaterThan(0)

    // Create button is disabled when title is empty
    // Base-UI duplicates buttons too; find visible ones
    const createButtons = body.getAllByRole('button', { name: /create/i })
    for (const btn of createButtons) {
      await expect(btn).toBeDisabled()
    }

    // Enables create button after entering a title
    const titleInputs =
      body.getAllByPlaceholderText(/task title|タスクのタイトル/i)
    const titleInput = atIndex(titleInputs, 0)
    await userEvent.type(titleInput, 'Test task')

    const enabledButton = body
      .getAllByRole('button', { name: /create/i })
      .find((btn) => !btn.hasAttribute('disabled'))
    await expect(enabledButton).toBeDefined()
  },
}

export const AddsTag: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)

    const addTagButtons = await body.findAllByRole('button', {
      name: '+ add tag',
    })
    const addTagButton = atIndex(addTagButtons, 0)
    await userEvent.click(addTagButton)

    const tagInputs = body.getAllByPlaceholderText('tag name')
    const tagInput = atIndex(tagInputs, 0)
    await userEvent.type(tagInput, 'urgent')
    await userEvent.keyboard('{Enter}')

    await expect(body.getAllByText('urgent').length).toBeGreaterThan(0)
  },
}

export const EscapeInTagInputDoesNotCloseModal: Story = {
  play: async ({ canvasElement, userEvent, args }) => {
    const body = within(canvasElement.ownerDocument.body)

    const addTagButtons = await body.findAllByRole('button', {
      name: '+ add tag',
    })
    const addTagButton = atIndex(addTagButtons, 0)
    await userEvent.click(addTagButton)

    const tagInputs = body.getAllByPlaceholderText('tag name')
    const tagInput = atIndex(tagInputs, 0)
    await userEvent.type(tagInput, 'urgent')
    await userEvent.keyboard('{Escape}')

    // The tag input closes on Escape, but the event must not bubble up to
    // the Dialog and close the whole modal (and discard the in-progress task).
    await expect(
      body.queryByPlaceholderText('tag name'),
    ).not.toBeInTheDocument()
    await expect(args.onOpenChange).not.toHaveBeenCalled()
  },
}

export const EscapeInShorthandMenuDoesNotCloseModal: Story = {
  play: async ({ canvasElement, userEvent, args }) => {
    const body = within(canvasElement.ownerDocument.body)
    const titleInputs =
      body.getAllByPlaceholderText(/task title|タスクのタイトル/i)
    const titleInput = atIndex(titleInputs, 0)

    await userEvent.type(titleInput, 'Buy milk @')
    await expect(await body.findAllByText('@today')).not.toHaveLength(0)

    await userEvent.keyboard('{Escape}')

    // The suggestion menu closes on Escape, but the event must not bubble up
    // to the Dialog and close the whole modal (and discard the in-progress task).
    await expect(body.queryByText('@today')).not.toBeInTheDocument()
    await expect(args.onOpenChange).not.toHaveBeenCalled()
  },
}

export const ShorthandSyntaxAppliesFields: Story = {
  parameters: {
    // The assertions below already prove the parsed values land in the
    // right fields. The filled-in look isn't new coverage: Start and Due
    // share the same date Input styling (WithDefaultStartDate already
    // renders one filled), Estimate reuses the same Input primitive with a
    // real value, and Context/Labels are already filled in AsSubtask.
    screenshot: { skip: true },
  },
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)
    const titleInputs =
      body.getAllByPlaceholderText(/task title|タスクのタイトル/i)
    const titleInput = atIndex(titleInputs, 0)

    const today = formatLocalDate(new Date())
    const tomorrowDate = new Date()
    tomorrowDate.setDate(tomorrowDate.getDate() + 1)
    const tomorrow = formatLocalDate(tomorrowDate)

    await userEvent.type(
      titleInput,
      'Buy milk @30m >today @tomorrow #groceries %work ',
    )

    await waitFor(async () => {
      await expect(
        atIndex(
          body.getAllByPlaceholderText(/task title|タスクのタイトル/i),
          0,
        ),
      ).toHaveValue('Buy milk ')
    })

    await expect(body.getAllByDisplayValue('30m').length).toBeGreaterThan(0)
    await expect(body.getAllByDisplayValue(today).length).toBeGreaterThan(0)
    await expect(body.getAllByDisplayValue(tomorrow).length).toBeGreaterThan(0)
    await expect(body.getAllByText('groceries').length).toBeGreaterThan(0)
    await expect(body.getAllByText('Work').length).toBeGreaterThan(0)
  },
}

export const SubmitsOnCmdEnterFromTitle: Story = {
  parameters: {
    // resetForm() on submit success clears the form back to the same blank
    // state EscapeInTagInputDoesNotCloseModal captures.
    screenshot: { skip: true },
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const body = within(canvasElement.ownerDocument.body)
    const titleInputs =
      body.getAllByPlaceholderText(/task title|タスクのタイトル/i)
    const titleInput = atIndex(titleInputs, 0)
    await userEvent.type(titleInput, 'Cmd enter from title')
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}')

    await waitFor(async () => {
      await expect(args.onOpenChange).toHaveBeenCalledWith(false)
    })
  },
}

export const CallsOnCreatedAfterSubmit: Story = {
  parameters: {
    // Same reasoning as SubmitsOnCmdEnterFromTitle above.
    screenshot: { skip: true },
  },
  args: {
    onCreated: fn(),
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const body = within(canvasElement.ownerDocument.body)
    const titleInputs =
      body.getAllByPlaceholderText(/task title|タスクのタイトル/i)
    const titleInput = atIndex(titleInputs, 0)
    await userEvent.type(titleInput, 'Notify on created')
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}')

    await waitFor(async () => {
      await expect(args.onCreated).toHaveBeenCalledWith({
        id: 'temp-id',
        number: 1,
        title: 'temp',
        description: null,
        status: 'todo',
        context: 'personal',
        labels: [],
      })
    })
  },
}

export const SubmitsOnCmdEnterFromDescription: Story = {
  parameters: {
    // Same reasoning as SubmitsOnCmdEnterFromTitle above.
    screenshot: { skip: true },
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const body = within(canvasElement.ownerDocument.body)
    const titleInputs =
      body.getAllByPlaceholderText(/task title|タスクのタイトル/i)
    const titleInput = atIndex(titleInputs, 0)
    await userEvent.type(titleInput, 'Cmd enter from description')

    const editors = Array.from(
      canvasElement.ownerDocument.body.querySelectorAll(
        '[contenteditable="true"]',
      ),
    )
    const editor = atIndex(editors, 0)
    await userEvent.click(editor)
    await userEvent.keyboard('some description text')
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}')

    await waitFor(async () => {
      await expect(args.onOpenChange).toHaveBeenCalledWith(false)
    })
  },
}

export const WithDefaultStartDate: Story = {
  args: {
    defaultStartDate: new Date().toISOString().slice(0, 10),
  },
}

export const WithDefaultEstimate: Story = {
  args: {
    defaultEstimateMinutes: 90,
  },
}

export const AsSubtask: Story = {
  args: {
    parentId: 'parent-task-id',
    parentTaskNumber: 12,
    parentTaskTitle: 'Fix login bug',
    defaultContext: 'work',
    defaultLabels: ['dev:tq'],
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)

    await expect(
      (await body.findAllByText(/subtask of #12 Fix login bug/)).length,
    ).toBeGreaterThan(0)
  },
}

export const CaretShorthandOverridesParent: Story = {
  args: {
    parentId: 'parent-task-id',
    parentTaskNumber: 12,
    parentTaskTitle: 'Fix login bug',
  },
  parameters: {
    // Same look as AsSubtask, just with a different #N/title pair — no new
    // appearance to verify.
    screenshot: { skip: true },
  },
  decorators: [
    (Story) => {
      seedParentOverridePreview()
      return (
        <QueryClientProvider client={parentOverrideQueryClient}>
          <div className="dark h-screen bg-background">
            <Story />
          </div>
        </QueryClientProvider>
      )
    },
  ],
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)
    const titleInputs =
      body.getAllByPlaceholderText(/task title|タスクのタイトル/i)
    const titleInput = atIndex(titleInputs, 0)

    await expect(
      (await body.findAllByText(/subtask of #12 Fix login bug/)).length,
    ).toBeGreaterThan(0)

    await userEvent.type(titleInput, '^34 ')

    await waitFor(async () => {
      await expect(
        (await body.findAllByText(/subtask of #34 Refactor auth module/))
          .length,
      ).toBeGreaterThan(0)
    })
    await expect(
      body.queryByText(/subtask of #12 Fix login bug/),
    ).not.toBeInTheDocument()
  },
}

// `parentId` is intentionally sent as the raw shorthand number ('34'), not
// the resolved task's UUID — see the comment on `effectiveParentId` in
// create-task-modal.tsx. This asserts the actual POST body so a future
// change to send the resolved UUID instead is caught.
let submittedTaskBody: unknown = null

export const CaretShorthandSubmitsRawParentNumber: Story = {
  args: {
    defaultContext: 'work',
  },
  parameters: {
    // Same look as CaretShorthandOverridesParent — the POST body is what
    // this story actually verifies.
    screenshot: { skip: true },
    msw: {
      // Story-level handlers replace meta's entirely (not merge), so the
      // labels/mentions handlers meta.parameters.msw.handlers provides above
      // must be repeated here alongside the POST override this story needs.
      // A GET /api/tasks/:id handler is also required: useCreateTask's
      // onSettled invalidates every taskKeys.all-prefixed query (including
      // the still-mounted parent-preview query) on success, triggering a
      // real refetch.
      handlers: [
        http.get('/api/labels', () => HttpResponse.json([])),
        http.get('/api/tasks/mentions', () => HttpResponse.json([])),
        http.get('/api/tasks/:id', () =>
          HttpResponse.json(
            makeTaskDetail({ number: 34, title: 'Refactor auth module' }),
          ),
        ),
        http.post('/api/tasks', async ({ request }) => {
          submittedTaskBody = await request.json()
          return HttpResponse.json({
            id: 'temp-id',
            number: 1,
            title: 'temp',
            description: null,
            status: 'todo',
            context: 'personal',
            labels: [],
          })
        }),
      ],
    },
  },
  decorators: [
    (Story) => {
      seedParentOverridePreview()
      return (
        <QueryClientProvider client={parentOverrideQueryClient}>
          <div className="dark h-screen bg-background">
            <Story />
          </div>
        </QueryClientProvider>
      )
    },
  ],
  play: async ({ canvasElement, userEvent }) => {
    submittedTaskBody = null
    const body = within(canvasElement.ownerDocument.body)
    const titleInputs =
      body.getAllByPlaceholderText(/task title|タスクのタイトル/i)
    const titleInput = atIndex(titleInputs, 0)

    await userEvent.type(titleInput, 'Fix bug ^34 ')

    await waitFor(async () => {
      await expect(
        (await body.findAllByText(/subtask of #34 Refactor auth module/))
          .length,
      ).toBeGreaterThan(0)
    })

    await userEvent.keyboard('{Meta>}{Enter}{/Meta}')

    await waitFor(async () => {
      await expect(submittedTaskBody).toEqual({
        title: 'Fix bug',
        context: 'work',
        parentId: '34',
      })
    })
  },
}

export const CaretShorthandParentNotFoundDisablesSubmit: Story = {
  decorators: [
    (Story) => {
      seedParentOverridePreview()
      return (
        <QueryClientProvider client={parentOverrideQueryClient}>
          <div className="dark h-screen bg-background">
            <Story />
          </div>
        </QueryClientProvider>
      )
    },
  ],
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)
    const titleInputs =
      body.getAllByPlaceholderText(/task title|タスクのタイトル/i)
    const titleInput = atIndex(titleInputs, 0)

    await userEvent.type(titleInput, 'Buy milk ^999 ')

    await waitFor(async () => {
      await expect(
        (await body.findAllByText('parent #999 not found')).length,
      ).toBeGreaterThan(0)
    })

    const createButtons = body.getAllByRole('button', { name: /create/i })
    for (const btn of createButtons) {
      await expect(btn).toBeDisabled()
    }

    // Dismissing the override falls back to no parent at all (this story
    // passes no parentId/parentTaskNumber props), re-enabling Create.
    const dismissButtons = body.getAllByRole('button', {
      name: 'Remove parent override',
    })
    await userEvent.click(atIndex(dismissButtons, 0))

    await waitFor(async () => {
      await expect(
        body.queryByText('parent #999 not found'),
      ).not.toBeInTheDocument()
    })
    for (const btn of body.getAllByRole('button', { name: /create/i })) {
      await expect(btn).not.toBeDisabled()
    }
  },
}

// Regression test: each `*` token is stripped from the title once
// completed, so a second `*weekday` typed afterward is parsed from a string
// that no longer contains the first one. create-task-modal.tsx must merge
// the parsed rule into the previous recurrenceRule state instead of
// replacing it, or the first weekday silently gets lost.
export const RecurrenceShorthandAccumulatesSequentiallyTypedWeekdays: Story = {
  args: {
    defaultContext: 'work',
  },
  parameters: {
    // Same look as CaretShorthandSubmitsRawParentNumber — the POST body is
    // what this story verifies.
    screenshot: { skip: true },
    msw: {
      handlers: [
        http.get('/api/labels', () => HttpResponse.json([])),
        http.get('/api/tasks/mentions', () => HttpResponse.json([])),
        http.post('/api/tasks', async ({ request }) => {
          submittedTaskBody = await request.json()
          return HttpResponse.json({
            id: 'temp-id',
            number: 1,
            title: 'temp',
            description: null,
            status: 'todo',
            context: 'work',
            labels: [],
          })
        }),
      ],
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    submittedTaskBody = null
    const body = within(canvasElement.ownerDocument.body)
    const titleInputs =
      body.getAllByPlaceholderText(/task title|タスクのタイトル/i)
    const titleInput = atIndex(titleInputs, 0)

    // Two separate userEvent.type calls, not one — each triggers its own
    // handleTitleChange call, matching how a real keystroke-by-keystroke
    // typing session (rather than a paste) reaches the component.
    await userEvent.type(titleInput, 'Write blog post *mon ')
    await userEvent.type(titleInput, '*thu ')
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}')

    await waitFor(async () => {
      await expect(submittedTaskBody).toEqual({
        title: 'Write blog post',
        context: 'work',
        recurrenceRule: { type: 'weekly', interval: 1, daysOfWeek: [1, 4] },
      })
    })
  },
}

let linkedGithubRequest: { taskId: string; url: string } | null = null

export const GithubUrlShorthandLinksIssueAndSeedsTitle: Story = {
  parameters: {
    // The chip/title-seed behavior is what this story verifies; no new look
    // beyond the parent indicator's already-covered chip styling.
    screenshot: { skip: true },
    msw: {
      // Story-level handlers replace meta's entirely (not merge) — see the
      // comment on CaretShorthandSubmitsRawParentNumber above.
      handlers: [
        http.get('/api/labels', () => HttpResponse.json([])),
        http.get('/api/tasks/mentions', () => HttpResponse.json([])),
        http.post('/api/tasks', () =>
          HttpResponse.json({
            id: 'temp-id',
            number: 1,
            title: 'temp',
            description: null,
            status: 'todo',
            context: 'personal',
            labels: [],
          }),
        ),
        http.post(
          '/api/tasks/:taskId/github-link',
          async ({ request, params }) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- this story controls the request body it sends (githubIssueUrl) in the play function below
            const { url } = (await request.json()) as { url: string }
            linkedGithubRequest = { taskId: String(params['taskId']), url }
            return HttpResponse.json({ id: 'link-1' })
          },
        ),
        // Task creation invalidates taskKeys.all, which the preview query is
        // nested under (see use-github-url-preview.ts), triggering a
        // background refetch of this same URL.
        http.post('/api/github/resolve', () =>
          HttpResponse.json(
            makeResolveGithubUrlResult({
              url: githubIssueUrl,
              title: 'Fix login bug',
            }),
          ),
        ),
      ],
    },
  },
  decorators: [
    (Story) => {
      seedGithubPreview()
      return (
        <QueryClientProvider client={githubPreviewQueryClient}>
          <div className="dark h-screen bg-background">
            <Story />
          </div>
        </QueryClientProvider>
      )
    },
  ],
  play: async ({ canvasElement, userEvent }) => {
    linkedGithubRequest = null
    const body = within(canvasElement.ownerDocument.body)
    const titleInputs =
      body.getAllByPlaceholderText(/task title|タスクのタイトル/i)
    const titleInput = atIndex(titleInputs, 0)

    await userEvent.type(titleInput, `${githubIssueUrl} `)

    // The URL is stripped from the (now empty) title, which is seeded from
    // the resolved issue's title as an editable initial value, and a chip
    // for the issue appears.
    await waitFor(async () => {
      await expect(
        atIndex(
          body.getAllByPlaceholderText(/task title|タスクのタイトル/i),
          0,
        ),
      ).toHaveValue('Fix login bug')
    })
    await expect(body.getAllByText('fohte/tq#123').length).toBeGreaterThan(0)

    await userEvent.keyboard('{Meta>}{Enter}{/Meta}')

    await waitFor(async () => {
      await expect(linkedGithubRequest).toEqual({
        taskId: 'temp-id',
        url: githubIssueUrl,
      })
    })
  },
}

export const GithubUrlShorthandUnresolvableDisablesSubmit: Story = {
  parameters: {
    screenshot: { skip: true },
  },
  decorators: [
    (Story) => {
      githubPreviewQueryClient.setQueryData(
        githubUrlPreviewKeys.preview(githubIssueUrl),
        null,
      )
      return (
        <QueryClientProvider client={githubPreviewQueryClient}>
          <div className="dark h-screen bg-background">
            <Story />
          </div>
        </QueryClientProvider>
      )
    },
  ],
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)
    const titleInputs =
      body.getAllByPlaceholderText(/task title|タスクのタイトル/i)
    const titleInput = atIndex(titleInputs, 0)

    await userEvent.type(titleInput, `Fix bug ${githubIssueUrl} `)

    await waitFor(async () => {
      await expect(
        (await body.findAllByText('could not resolve GitHub link')).length,
      ).toBeGreaterThan(0)
    })

    const createButtons = body.getAllByRole('button', { name: /create/i })
    for (const btn of createButtons) {
      await expect(btn).toBeDisabled()
    }
  },
}

export const GithubUrlShorthandAlreadyLinkedDisablesSubmit: Story = {
  parameters: {
    screenshot: { skip: true },
  },
  decorators: [
    (Story) => {
      githubPreviewQueryClient.setQueryData(
        githubUrlPreviewKeys.preview(githubIssueUrl),
        {
          linked: true,
          task: makeTaskDetail({
            id: 'other-task-id',
            number: 99,
            title: 'Existing task',
            githubLinks: [makeGithubLink({ url: githubIssueUrl, number: 123 })],
          }),
        },
      )
      return (
        <QueryClientProvider client={githubPreviewQueryClient}>
          <div className="dark h-screen bg-background">
            <Story />
          </div>
        </QueryClientProvider>
      )
    },
  ],
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)
    const titleInputs =
      body.getAllByPlaceholderText(/task title|タスクのタイトル/i)
    const titleInput = atIndex(titleInputs, 0)

    await userEvent.type(titleInput, `Fix bug ${githubIssueUrl} `)

    await waitFor(async () => {
      await expect(
        (await body.findAllByText('already linked to another task')).length,
      ).toBeGreaterThan(0)
    })

    const createButtons = body.getAllByRole('button', { name: /create/i })
    for (const btn of createButtons) {
      await expect(btn).toBeDisabled()
    }
  },
}

const longDescription = [
  '## Why',
  '',
  'This is a very long description to test scrolling behavior.',
  '',
  '## What',
  '',
  ...Array.from(
    { length: 30 },
    (_, i) => `- Task item ${String(i + 1)}: do something important`,
  ),
  '',
  '## Notes',
  '',
  ...Array.from(
    { length: 10 },
    (_, i) =>
      `Paragraph ${String(i + 1)}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
  ),
].join('\n')

export const LongDescription: Story = {
  args: {
    defaultDescription: longDescription,
    defaultStartDate: new Date().toISOString().slice(0, 10),
  },
}
