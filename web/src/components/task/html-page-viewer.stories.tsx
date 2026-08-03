import type { Meta, StoryObj } from '@storybook/react-vite'

import { HtmlPageViewer } from '#components/task/html-page-viewer'

const meta = {
  title: 'Task/TaskPages/HtmlPageViewer',
  component: HtmlPageViewer,
  parameters: {
    layout: 'padded',
  },
  args: {
    className: 'h-[400px]',
  },
} satisfies Meta<typeof HtmlPageViewer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    content:
      '<!doctype html><html><body style="font-family: sans-serif; margin: 0; padding: 16px;"><h1>Hello from HTML page</h1><p>This content is rendered inside a sandboxed iframe.</p></body></html>',
  },
}

export const WithScript: Story = {
  args: {
    content:
      '<!doctype html><html><body style="font-family: sans-serif; margin: 0; padding: 16px;">' +
      '<p id="counter">Clicks: 0</p>' +
      '<button id="btn" type="button">Click me</button>' +
      '<script>' +
      'let count = 0;' +
      'document.getElementById("btn").addEventListener("click", () => {' +
      'count += 1;' +
      'document.getElementById("counter").textContent = "Clicks: " + count;' +
      '});' +
      '</script>' +
      '</body></html>',
  },
}
