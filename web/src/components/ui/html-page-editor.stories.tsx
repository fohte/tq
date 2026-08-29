import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'

import { HtmlPageEditor } from '#components/ui/html-page-editor'
import { assertDefined } from '#lib/test-utils'

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
      <div className="w-full max-w-3xl border border-border bg-card p-2.5 text-sm">
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
  // Regression check: the root itself carries the fixed 400px in 'default'
  // size, with the SegmentedControl row absorbed inside it — not stacked on
  // top, which would push the total past 400px.
  play: async ({ canvasElement }) => {
    const root = assertDefined(
      canvasElement.querySelector('[data-slot="html-page-editor"]'),
      'HtmlPageEditor always renders its root',
    )

    await expect(root.getBoundingClientRect().height).toBe(400)
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

// Regression check: 'fill' (a full-page editor, e.g. task-page-editor.tsx's
// HTML branch) must stretch to match a sized flex ancestor rather than the
// 'default' size's fixed 400px.
export const Fill: Story = {
  args: {
    defaultValue: SAMPLE_HTML,
    size: 'fill',
  },
  decorators: [
    (Story) => (
      <div className="flex h-70 flex-col">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const iframe = assertDefined(
      canvasElement.querySelector('iframe'),
      'HtmlPageEditor always renders the preview iframe',
    )

    const height = iframe.getBoundingClientRect().height
    await expect(height).toBeGreaterThan(200)
    await expect(height).toBeLessThan(280)
  },
}
