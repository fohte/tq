import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { HtmlPageEditor } from '#components/ui/html-page-editor'
import { assertDefined } from '#lib/test-utils'

const SAMPLE_HTML =
  '<!doctype html><html><body style="font-family: sans-serif; margin: 0; padding: 16px;"><h1>Hello from HTML page</h1><p>This is rendered inside a sandboxed iframe.</p></body></html>'

describe('HtmlPageEditor', () => {
  // Regression check: the root itself carries the fixed 400px in 'default'
  // size, with the SegmentedControl row absorbed inside it — not stacked on
  // top, which would push the total past 400px.
  it("renders its own fixed height in the 'default' size", () => {
    render(<HtmlPageEditor placeholder="Write HTML..." onChange={vi.fn()} />)

    const root = assertDefined(
      document.querySelector('[data-slot="html-page-editor"]'),
      'HtmlPageEditor always renders its root',
    )
    expect(root.getBoundingClientRect().height).toBe(400)
  })

  it('shows raw HTML source when switching to Source', async () => {
    const user = userEvent.setup()
    render(<HtmlPageEditor defaultValue={SAMPLE_HTML} onChange={vi.fn()} />)

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Source' }))

    expect(screen.getByRole('textbox')).toHaveValue(SAMPLE_HTML)
  })

  // Regression check: 'fill' (a full-page editor, e.g. task-page-editor.tsx's
  // HTML branch) must stretch to match a sized flex ancestor rather than the
  // 'default' size's fixed 400px.
  it("stretches to match a sized flex ancestor in the 'fill' size", () => {
    render(
      <div className="flex h-70 flex-col">
        <HtmlPageEditor
          defaultValue={SAMPLE_HTML}
          size="fill"
          onChange={vi.fn()}
        />
      </div>,
    )

    const iframe = assertDefined(
      document.querySelector('iframe'),
      'HtmlPageEditor always renders the preview iframe',
    )
    const height = iframe.getBoundingClientRect().height
    expect(height).toBeGreaterThan(200)
    expect(height).toBeLessThan(280)
  })
})
