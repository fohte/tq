import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { EditLabelDialog } from '#components/label/edit-label-dialog'
import type { Label } from '#hooks/use-labels'
import { clickSelectOption } from '#lib/test-utils'

const label: Label = {
  id: '00000000-0000-0000-0000-000000000301',
  name: 'oncall',
  color: null,
  context: 'work',
  createdAt: '2026-03-20T00:00:00.000Z',
}

const meta = {
  title: 'Label/EditLabelDialog',
  component: EditLabelDialog,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
          })
        }
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: {
    label,
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof EditLabelDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByDisplayValue('oncall')).toBeInTheDocument()
  },
}

export const EmptyNameDisablesSave: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const input = await body.findByDisplayValue('oncall')
    await userEvent.clear(input)

    await expect(body.getByRole('button', { name: 'Save' })).toBeDisabled()
  },
}

export const RenameAndSubmit: Story = {
  parameters: {
    msw: {
      handlers: [
        http.patch('/api/labels/:id', () =>
          HttpResponse.json({ ...label, name: 'urgent' }),
        ),
      ],
    },
    screenshot: { skip: true },
  },
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body)
    const input = await body.findByDisplayValue('oncall')
    await userEvent.clear(input)
    await userEvent.type(input, 'urgent')
    await userEvent.click(await body.findByRole('button', { name: 'Save' }))

    await waitFor(async () => {
      await expect(args.onOpenChange).toHaveBeenCalledWith(false)
    })
  },
}

// Captured by the msw handler below, reset at the start of each play function
// that submits — proves the request body, not just the resulting UI state.
let patchedBody: unknown = null

export const ChangeContextAndSubmit: Story = {
  parameters: {
    msw: {
      handlers: [
        http.patch('/api/labels/:id', async ({ request }) => {
          patchedBody = await request.json()
          return HttpResponse.json({ ...label, context: 'personal' })
        }),
      ],
    },
    screenshot: { skip: true },
  },
  play: async ({ canvasElement, args }) => {
    patchedBody = null
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(body.getByRole('combobox'))
    await clickSelectOption(
      userEvent,
      await body.findByRole('option', { name: 'Personal' }),
    )
    await userEvent.click(await body.findByRole('button', { name: 'Save' }))

    await waitFor(async () => {
      await expect(args.onOpenChange).toHaveBeenCalledWith(false)
    })
    await expect(patchedBody).toEqual({ name: 'oncall', context: 'personal' })
  },
}

export const NameConflictShowsError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.patch('/api/labels/:id', () =>
          HttpResponse.json(
            { error: 'A label with this name already exists' },
            { status: 409 },
          ),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const input = await body.findByDisplayValue('oncall')
    await userEvent.clear(input)
    await userEvent.type(input, 'urgent')
    await userEvent.click(await body.findByRole('button', { name: 'Save' }))

    await expect(
      await body.findByText('A label with this name already exists'),
    ).toBeInTheDocument()
  },
}
