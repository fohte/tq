import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'

import { HtmlPageEditor } from '#components/ui/html-page-editor'

const SAMPLE_HTML =
  '<!doctype html><html><body style="font-family: sans-serif; margin: 0; padding: 16px;"><h1>Hello from HTML page</h1><p>This is rendered inside a sandboxed iframe.</p></body></html>'

const meta = {
  title: 'UI/HtmlPageEditor',
  component: HtmlPageEditor,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="h-[400px] w-[600px] border border-border bg-card p-2.5 text-sm">
        <Story />
      </div>
    ),
  ],
  args: {
    onChange: fn(),
  },
} satisfies Meta<typeof HtmlPageEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    placeholder: 'Write HTML...',
  },
}

export const WithContent: Story = {
  args: {
    defaultValue: SAMPLE_HTML,
  },
}

export const SwitchToSourceShowsRawHtml: Story = {
  args: {
    defaultValue: SAMPLE_HTML,
  },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Source' }))

    await expect(canvas.getByRole('textbox')).toHaveValue(SAMPLE_HTML)
  },
}
