import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, fn, within } from 'storybook/test'

import { TaskFilterQueryInput } from '#components/task/task-filter-query-input'

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
  title: 'Task/TaskFilterQueryInput',
  component: TaskFilterQueryInput,
  parameters: {
    layout: 'centered',
    msw: { handlers: [emptySuggestHandler] },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="flex w-96 border border-border bg-background px-3 py-2">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  args: {
    query: 'is:todo sort:updated',
    onCommit: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof TaskFilterQueryInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ShowsSuggestionsWithoutLosingFocus: Story = {
  args: {
    query: '',
  },
  parameters: {
    msw: { handlers: [suggestHandler] },
  },
  play: async ({ canvasElement, canvas, userEvent }) => {
    const input = canvas.getByRole('textbox', { name: 'Edit filter query' })
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
    query: '',
  },
  parameters: {
    msw: { handlers: [suggestHandler] },
  },
  play: async ({ canvasElement, canvas, userEvent }) => {
    const input = canvas.getByRole<HTMLInputElement>('textbox', {
      name: 'Edit filter query',
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
    query: 'sort:updated',
  },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox', { name: 'Edit filter query' })
    // Overwrite the whole value instead of appending, so the result doesn't
    // depend on where the browser places the caret after a click.
    await userEvent.clear(input)
    await userEvent.type(input, 'sort:updated has:pages')
    await userEvent.keyboard('{Enter}')

    await expect(args.onCommit).toHaveBeenCalledWith('sort:updated has:pages')
  },
}

export const CancelsOnEscape: Story = {
  args: {
    query: 'sort:updated',
  },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox', { name: 'Edit filter query' })
    // Overwrite the whole value instead of appending, so the result doesn't
    // depend on where the browser places the caret after a click.
    await userEvent.clear(input)
    await userEvent.type(input, 'sort:updated has:pages')
    await userEvent.keyboard('{Escape}')

    await expect(args.onCancel).toHaveBeenCalled()
    await expect(args.onCommit).not.toHaveBeenCalled()
  },
}

export const CancelsOnBlurWithoutChange: Story = {
  args: {
    query: 'sort:updated',
  },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox', { name: 'Edit filter query' })
    await userEvent.click(input)
    await userEvent.tab()

    await expect(args.onCancel).toHaveBeenCalled()
    await expect(args.onCommit).not.toHaveBeenCalled()
  },
}

export const CommitsOnBlurAfterChange: Story = {
  args: {
    query: 'sort:updated',
  },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox', { name: 'Edit filter query' })
    // Overwrite the whole value instead of appending, so the result doesn't
    // depend on where the browser places the caret after a click.
    await userEvent.clear(input)
    await userEvent.type(input, 'sort:updated has:pages')
    await userEvent.tab()

    await expect(args.onCommit).toHaveBeenCalledWith('sort:updated has:pages')
  },
}
