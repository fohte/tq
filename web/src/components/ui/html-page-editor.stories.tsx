import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

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
}

export const WithContent: Story = {
  args: {
    defaultValue: SAMPLE_HTML,
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
}
