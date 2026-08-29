import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { useState } from 'react'
import { expect, fn, within } from 'storybook/test'

import { TaskFilterFreeTextInput } from '#components/task/task-filter-free-text-input'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const suggestionFixtures = [
  { value: 'is:todo', display: 'Todo', category: 'is' },
  { value: 'is:in_progress', display: 'In Progress', category: 'is' },
  { value: 'is:completed', display: 'Completed', category: 'is' },
]

const suggestHandler = http.get('/api/tasks/search/suggest', ({ request }) => {
  const prefix = new URL(request.url).searchParams.get('prefix') ?? ''
  return HttpResponse.json(
    suggestionFixtures.filter((s) => s.value.startsWith(prefix)),
  )
})

const emptySuggestHandler = http.get('/api/tasks/search/suggest', () =>
  HttpResponse.json([]),
)

const meta = {
  title: 'Task/TaskFilterFreeTextInput',
  component: TaskFilterFreeTextInput,
  parameters: {
    layout: 'centered',
    msw: { handlers: [emptySuggestHandler] },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="flex w-full max-w-96 border border-border bg-background px-3 py-2">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  args: {
    id: 'story-free-text',
    freeText: 'hello',
    onCommit: fn(),
    onBackspaceEmpty: fn(),
  },
} satisfies Meta<typeof TaskFilterFreeTextInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: {
    freeText: '',
    placeholder: 'Filter…',
  },
}

export const ShowsSuggestionsWithoutLosingFocus: Story = {
  args: {
    freeText: '',
  },
  parameters: {
    msw: { handlers: [suggestHandler] },
  },
  play: async ({ canvasElement, canvas, userEvent }) => {
    const input = canvas.getByRole('textbox', { name: 'Filter query' })
    // `extractCurrentPrefix` only surfaces suggestions once the token ends
    // with the `:` separator (or has no colon at all) — see its doc comment
    // in use-search.ts.
    await userEvent.type(input, 'is:')

    // AnchoredPopup renders the suggestion list through a portal into
    // document.body, so it isn't inside canvasElement.
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('is:todo')).toBeVisible()
    await expect(input).toHaveFocus()
  },
}

export const AppliesSuggestionOnTab: Story = {
  args: {
    freeText: '',
  },
  parameters: {
    msw: { handlers: [suggestHandler] },
  },
  play: async ({ canvasElement, canvas, userEvent }) => {
    const input = canvas.getByRole<HTMLInputElement>('textbox', {
      name: 'Filter query',
    })
    await userEvent.type(input, 'is:')

    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('is:todo')).toBeVisible()

    await userEvent.keyboard('{Tab}')
    await expect(input).toHaveValue('is:todo ')
  },
}

export const CommitsOnEnterWhenNoSuggestions: Story = {
  args: {
    freeText: 'sort:updated',
  },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox', { name: 'Filter query' })
    // Overwrite the whole value instead of appending, so the result doesn't
    // depend on where the browser places the caret after a click.
    await userEvent.clear(input)
    await userEvent.type(input, 'sort:updated has:pages')
    await userEvent.keyboard('{Enter}')

    await expect(args.onCommit).toHaveBeenCalledWith('sort:updated has:pages')
    // The committed text fully parses into structured fields, so the box
    // clears immediately — it doesn't wait for `freeText` to round-trip
    // back down as a prop, which wouldn't happen in this story anyway
    // since `onCommit` is a bare mock here.
    await expect(input).toHaveValue('')
  },
}

export const ResetsOnEscapeWithoutCommitting: Story = {
  args: {
    freeText: 'sort:updated',
  },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox', { name: 'Filter query' })
    await userEvent.clear(input)
    await userEvent.type(input, 'sort:updated has:pages')
    await userEvent.keyboard('{Escape}')

    await expect(input).toHaveValue('sort:updated')
    await expect(args.onCommit).not.toHaveBeenCalled()
  },
}

export const DoesNotCommitOnBlurWithoutChange: Story = {
  args: {
    freeText: 'sort:updated',
  },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox', { name: 'Filter query' })
    await userEvent.click(input)
    await userEvent.tab()

    await expect(args.onCommit).not.toHaveBeenCalled()
  },
}

export const CommitsOnBlurAfterChange: Story = {
  args: {
    freeText: 'sort:updated',
  },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox', { name: 'Filter query' })
    // Overwrite the whole value instead of appending, so the result doesn't
    // depend on where the browser places the caret after a click.
    await userEvent.clear(input)
    await userEvent.type(input, 'sort:updated has:pages')
    await userEvent.tab()

    await expect(args.onCommit).toHaveBeenCalledWith('sort:updated has:pages')
  },
}

export const BackspaceOnEmptyNotifiesParent: Story = {
  args: {
    freeText: '',
  },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox', { name: 'Filter query' })
    await userEvent.click(input)
    await userEvent.keyboard('{Backspace}')

    await expect(args.onBackspaceEmpty).toHaveBeenCalled()
  },
}

export const BackspaceWithTextDoesNotNotifyParent: Story = {
  args: {
    freeText: 'hello',
  },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox', { name: 'Filter query' })
    await userEvent.click(input)
    await userEvent.keyboard('{Backspace}')

    await expect(args.onBackspaceEmpty).not.toHaveBeenCalled()
  },
}

// Drives real freeText prop round-trips (unlike the other stories above,
// where onCommit is a bare mock) to exercise the resync effect's focus
// guard: an external freeText change — e.g. another chip removed elsewhere
// in the row — must not clobber text the user is still typing, but must
// still apply once this field isn't the one holding it back.
function FreeTextInputHarness({
  initialFreeText,
}: {
  initialFreeText: string
}) {
  const [freeText, setFreeText] = useState(initialFreeText)
  return (
    <div className="flex w-full max-w-96 flex-col gap-2">
      <div className="flex border border-border bg-background px-3 py-2">
        <TaskFilterFreeTextInput
          id="harness-free-text"
          freeText={freeText}
          onCommit={setFreeText}
          onBackspaceEmpty={() => {}}
        />
      </div>
      <button
        type="button"
        // Prevent the default mousedown behavior of shifting focus onto
        // this button, so a click here doesn't itself blur the free-text
        // input and mask the guard this harness exists to exercise — same
        // trick the component uses for its own suggestion buttons.
        onMouseDown={(e) => {
          e.preventDefault()
        }}
        onClick={() => {
          setFreeText('external-change')
        }}
      >
        Simulate external change
      </button>
    </div>
  )
}

export const PreservesUnsentEditWhileFocusedDuringExternalChange: StoryObj<
  typeof FreeTextInputHarness
> = {
  render: (args) => <FreeTextInputHarness {...args} />,
  args: {
    initialFreeText: '',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  parameters: meta.parameters,
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('textbox', { name: 'Filter query' })
    await userEvent.click(input)
    await userEvent.type(input, 'typing')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Simulate external change' }),
    )

    await expect(input).toHaveValue('typing')
  },
}

export const AppliesExternalChangeWhenNotFocused: StoryObj<
  typeof FreeTextInputHarness
> = {
  render: (args) => <FreeTextInputHarness {...args} />,
  args: {
    initialFreeText: '',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  parameters: meta.parameters,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Simulate external change' }),
    )

    await expect(
      canvas.getByRole('textbox', { name: 'Filter query' }),
    ).toHaveValue('external-change')
  },
}
