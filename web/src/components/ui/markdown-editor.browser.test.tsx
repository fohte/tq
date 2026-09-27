import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { MarkdownEditor } from '#components/ui/markdown-editor'
import { assertDefined, findEditorText } from '#lib/test-utils'

const TRAILING_BLOCKQUOTE_CONTENT =
  'Some intro text.\n\n> A blockquote at the very end.'

beforeAll(async () => {
  await import('#components/ui/markdown-editor-crepe')
}, 20_000)

const TRAILING_BLOCK_CONTENTS = [
  {
    kind: 'list',
    markdown: '- First item\n- A list item.',
    visibleText: 'First item',
    selector: '.milkdown .ProseMirror ul',
  },
  {
    kind: 'code block',
    markdown: 'Some intro text.\n\n```text\nA code block.\n```',
    visibleText: 'Some intro text.',
    selector: '.milkdown .ProseMirror .cm-editor',
  },
  {
    kind: 'table',
    markdown:
      'Some intro text.\n\n| Column A | Column B |\n| --- | --- |\n| Value A | Value B |',
    visibleText: 'Some intro text.',
    selector: '.milkdown .ProseMirror table',
  },
  {
    kind: 'blockquote',
    markdown: TRAILING_BLOCKQUOTE_CONTENT,
    visibleText: 'Some intro text.',
    selector: '.milkdown .ProseMirror blockquote',
  },
] as const

async function waitForMarkdownUpdateNotifications() {
  // Milkdown's listener debounces document updates for 200 ms.
  await new Promise((resolve) => setTimeout(resolve, 300))
}

function getModeToggleResult(
  modeAfterEntering: string | null,
  wrapper: Element,
  onChangeCalls: readonly (readonly string[])[],
) {
  return [
    modeAfterEntering,
    wrapper.getAttribute('data-view-mode'),
    onChangeCalls,
  ]
}

describe('MarkdownEditor size', () => {
  // Regression check: 'compact' (a few-lines inline editor, e.g. a
  // task/project description) must render its own min-height (120px) rather
  // than the 'default' size's 400px or collapsing to the content's own
  // height.
  it("renders the compact size's own min-height", async () => {
    const { container } = render(
      <MarkdownEditor placeholder="Write something..." size="compact" />,
    )
    await waitFor(() => {
      expect(container.querySelector('.milkdown-wrapper')).not.toBeNull()
    })

    const wrapper = assertDefined(
      container.querySelector('.milkdown-wrapper'),
      'MarkdownEditor always renders its wrapper',
    )
    const height = wrapper.getBoundingClientRect().height
    expect(height).toBeGreaterThanOrEqual(120)
    expect(height).toBeLessThan(200)
  })
})

describe('MarkdownEditor mode toggle', () => {
  it.each(TRAILING_BLOCK_CONTENTS)(
    'does not autosave when opening and exiting a trailing $kind without editing',
    async ({ markdown, selector, visibleText }) => {
      const onChange = vi.fn<(markdown: string) => void>()
      const { container } = render(
        <MarkdownEditor
          defaultValue={markdown}
          viewEditToggle={{}}
          onChange={onChange}
        />,
      )
      await screen.findByText(visibleText, {}, { timeout: 5000 })

      const wrapper = assertDefined(
        container.querySelector('.milkdown-wrapper'),
        'MarkdownEditor always renders its wrapper and root',
      )
      const trailingBlock = assertDefined(
        container.querySelector(selector),
        'the editor renders the trailing block',
      )
      const user = userEvent.setup()
      await user.click(trailingBlock)
      const modeAfterEntering = wrapper.getAttribute('data-view-mode')

      // The click enters edit mode after the event, so Escape must target the
      // wrapper directly instead of relying on keyboard focus.
      fireEvent.keyDown(wrapper, { key: 'Escape' })
      await waitForMarkdownUpdateNotifications()

      expect(
        getModeToggleResult(modeAfterEntering, wrapper, onChange.mock.calls),
      ).toEqual(['edit', 'view', []])
    },
  )

  it('autosaves changes when starting in edit mode', async () => {
    const onChange = vi.fn<(markdown: string) => void>()
    const { container } = render(
      <MarkdownEditor
        defaultValue={TRAILING_BLOCKQUOTE_CONTENT}
        viewEditToggle={{ defaultMode: 'edit' }}
        onChange={onChange}
      />,
    )
    await screen.findByText('Some intro text.')

    const blockquote = assertDefined(
      container.querySelector('.milkdown .ProseMirror blockquote'),
      'editor renders the blockquote',
    )
    const user = userEvent.setup()
    await user.click(blockquote)
    await user.keyboard('!')
    await screen.findByText('A blockquote at the very end.!')
    await waitForMarkdownUpdateNotifications()

    expect(onChange.mock.calls).toEqual([[`${TRAILING_BLOCKQUOTE_CONTENT}!\n`]])
  })

  it('reports empty Markdown after removing the only paragraph content', async () => {
    const onChange = vi.fn<(markdown: string) => void>()
    const { container } = render(
      <MarkdownEditor
        defaultValue=""
        viewEditToggle={{}}
        onChange={onChange}
      />,
    )
    await waitFor(() => {
      expect(container.querySelector('.milkdown .ProseMirror p')).not.toBeNull()
    })

    const paragraph = assertDefined(
      container.querySelector('.milkdown .ProseMirror p'),
      'an empty document renders its paragraph',
    )
    const user = userEvent.setup()
    await user.click(paragraph)
    await user.click(paragraph)
    await user.keyboard('x')
    await findEditorText('x')
    await waitForMarkdownUpdateNotifications()
    await user.keyboard('{Backspace}')
    await waitForMarkdownUpdateNotifications()

    expect(onChange.mock.calls).toEqual([['x\n'], ['']])
  })

  it('autosaves a change that is reverted before exiting edit mode', async () => {
    const onChange = vi.fn<(markdown: string) => void>()
    const { container } = render(
      <MarkdownEditor
        defaultValue={TRAILING_BLOCKQUOTE_CONTENT}
        viewEditToggle={{}}
        onChange={onChange}
      />,
    )
    await findEditorText('Some intro text.')

    const blockquote = assertDefined(
      container.querySelector('.milkdown .ProseMirror blockquote'),
      'editor renders the blockquote',
    )
    const user = userEvent.setup()
    await user.click(blockquote)
    await user.click(blockquote)
    await user.keyboard('!')
    await screen.findByText('A blockquote at the very end.!')
    await waitForMarkdownUpdateNotifications()
    await user.keyboard('{Backspace}')
    await screen.findByText('A blockquote at the very end.')
    await waitForMarkdownUpdateNotifications()

    expect(onChange.mock.calls).toEqual([
      [`${TRAILING_BLOCKQUOTE_CONTENT}!\n`],
      [`${TRAILING_BLOCKQUOTE_CONTENT}\n`],
    ])
  })

  it('continues notifying changes in an always-editable editor', async () => {
    const onChange = vi.fn<(markdown: string) => void>()
    const { container } = render(
      <MarkdownEditor defaultValue="Editable content." onChange={onChange} />,
    )
    await screen.findByText('Editable content.')

    const paragraph = assertDefined(
      container.querySelector('.milkdown .ProseMirror p'),
      'editor renders a paragraph',
    )
    const user = userEvent.setup()
    await user.click(paragraph)
    await user.keyboard('!')
    await screen.findByText('Editable content.!')
    await waitForMarkdownUpdateNotifications()

    expect(onChange.mock.calls).toEqual([['Editable content.!\n']])
  })

  it('changes the document after entering edit mode and typing', async () => {
    const { container } = render(
      <MarkdownEditor
        defaultValue={TRAILING_BLOCKQUOTE_CONTENT}
        viewEditToggle={{}}
      />,
    )
    await findEditorText('Some intro text.')

    const wrapper = assertDefined(
      container.querySelector('.milkdown-wrapper'),
      'MarkdownEditor always renders its wrapper',
    )
    const blockquote = assertDefined(
      container.querySelector('.milkdown .ProseMirror blockquote'),
      'editor always renders the blockquote',
    )

    const user = userEvent.setup()
    // A first click flips the editor into edit mode, but Crepe only applies
    // contenteditable=true in a React effect that runs after that click
    // event has already finished. A second click, now that it's actually
    // editable, gives it real focus so the following keystroke lands in the
    // document.
    await user.click(blockquote)
    await user.click(blockquote)
    await user.keyboard('!')

    await findEditorText('A blockquote at the very end.!')

    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(wrapper).toHaveAttribute('data-view-mode', 'view'),
    )
    expect(
      screen.getByText('A blockquote at the very end.!'),
    ).toBeInTheDocument()
  })
})

function ControlledEditingHarness({ events }: { events: string[] }) {
  const [editing, setEditing] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setEditing(true)
        }}
      >
        open editor
      </button>
      <button type="button">outside editor</button>
      <MarkdownEditor
        defaultValue={TRAILING_BLOCKQUOTE_CONTENT}
        editing={editing}
        onEditingChange={(nextEditing) => {
          events.push(`editing:${String(nextEditing)}`)
          setEditing(nextEditing)
        }}
        viewEditToggle={{
          onExitEditMode: () => events.push('flush'),
        }}
      />
    </>
  )
}

function getModeAndEvents(wrapper: Element, events: string[]) {
  return { mode: wrapper.getAttribute('data-view-mode'), events }
}

function getEditorFocusState(
  wrapper: Element,
  root: Element,
  text: string | null,
) {
  return {
    mode: wrapper.getAttribute('data-view-mode'),
    focused: document.activeElement === root,
    text,
  }
}

describe('MarkdownEditor controlled editing', () => {
  it('stays in view mode when the body is clicked', async () => {
    const events: string[] = []
    const { container } = render(<ControlledEditingHarness events={events} />)
    await findEditorText('Some intro text.')

    const wrapper = assertDefined(
      container.querySelector('.milkdown-wrapper'),
      'MarkdownEditor always renders its wrapper',
    )
    const paragraph = assertDefined(
      container.querySelector('.milkdown .ProseMirror p'),
      'editor always renders a paragraph',
    )

    await userEvent.setup().click(paragraph)

    expect(getModeAndEvents(wrapper, events)).toEqual({
      mode: 'view',
      events: [],
    })
  })

  it('focuses the editor when the caller opens edit mode', async () => {
    const events: string[] = []
    const { container } = render(<ControlledEditingHarness events={events} />)
    await findEditorText('Some intro text.')

    const wrapper = assertDefined(
      container.querySelector('.milkdown-wrapper'),
      'MarkdownEditor always renders its wrapper',
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'open editor' }))
    await user.keyboard('!')

    const editedText = await findEditorText('!Some intro text.')
    const proseMirrorRoot = assertDefined(
      container.querySelector('.milkdown .ProseMirror'),
      'MarkdownEditor always renders its root',
    )
    expect(
      getEditorFocusState(wrapper, proseMirrorRoot, editedText.textContent),
    ).toEqual({
      mode: 'edit',
      focused: true,
      text: '!Some intro text.',
    })
  })

  it('flushes and notifies the caller when Escape exits edit mode', async () => {
    const events: string[] = []
    const { container } = render(<ControlledEditingHarness events={events} />)
    await findEditorText('Some intro text.')

    const wrapper = assertDefined(
      container.querySelector('.milkdown-wrapper'),
      'MarkdownEditor always renders its wrapper',
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'open editor' }))
    await user.keyboard('{Escape}')

    expect(getModeAndEvents(wrapper, events)).toEqual({
      mode: 'view',
      events: ['flush', 'editing:false'],
    })
  })

  it('flushes and notifies the caller when focus leaves edit mode', async () => {
    const events: string[] = []
    const { container } = render(<ControlledEditingHarness events={events} />)
    await findEditorText('Some intro text.')

    const wrapper = assertDefined(
      container.querySelector('.milkdown-wrapper'),
      'MarkdownEditor always renders its wrapper',
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'open editor' }))
    await user.click(screen.getByRole('button', { name: 'outside editor' }))

    expect(getModeAndEvents(wrapper, events)).toEqual({
      mode: 'view',
      events: ['flush', 'editing:false'],
    })
  })
})

// Simulates a `defaultValue` update arriving from outside the editor (e.g.
// another tab), without pulling in React Query and a real task/page fixture.
function ExternalUpdateHarness({
  initialValue,
  updatedValue,
}: {
  initialValue: string
  updatedValue: string
}) {
  const [value, setValue] = useState(initialValue)
  return (
    <>
      <button
        type="button"
        // Prevents moving focus to this button so the editor doesn't
        // blur/exit edit mode.
        onMouseDown={(e) => {
          e.preventDefault()
        }}
        onClick={() => {
          setValue(updatedValue)
        }}
      >
        simulate external update
      </button>
      <MarkdownEditor defaultValue={value} viewEditToggle={{}} />
    </>
  )
}

describe('MarkdownEditor external updates', () => {
  it('replaces content when an external update arrives in view mode', async () => {
    render(
      <ExternalUpdateHarness
        initialValue="Original content."
        updatedValue="Updated from another tab."
      />,
    )
    await findEditorText('Original content.')

    const user = userEvent.setup()
    await user.click(
      screen.getByRole('button', { name: 'simulate external update' }),
    )

    await findEditorText('Updated from another tab.')
    expect(screen.queryByText('Original content.')).not.toBeInTheDocument()
  })

  it('does not disrupt typing when an external update arrives mid-edit', async () => {
    const { container } = render(
      <ExternalUpdateHarness
        initialValue={TRAILING_BLOCKQUOTE_CONTENT}
        updatedValue="Overwritten from outside while editing."
      />,
    )
    await findEditorText('Some intro text.')
    const blockquote = assertDefined(
      container.querySelector('.milkdown .ProseMirror blockquote'),
      'editor always renders the blockquote',
    )

    const user = userEvent.setup()
    await user.click(blockquote)
    await user.click(blockquote)
    await user.keyboard('!')

    await findEditorText('A blockquote at the very end.!')

    await user.click(
      screen.getByRole('button', { name: 'simulate external update' }),
    )

    await findEditorText('A blockquote at the very end.!')
    expect(
      screen.queryByText('Overwritten from outside while editing.'),
    ).not.toBeInTheDocument()
  })

  it('applies a deferred external update once Escape returns to view mode', async () => {
    const { container } = render(
      <ExternalUpdateHarness
        initialValue={TRAILING_BLOCKQUOTE_CONTENT}
        updatedValue="Overwritten from outside while editing."
      />,
    )
    await findEditorText('Some intro text.')
    const wrapper = assertDefined(
      container.querySelector('.milkdown-wrapper'),
      'MarkdownEditor always renders its wrapper',
    )
    const blockquote = assertDefined(
      container.querySelector('.milkdown .ProseMirror blockquote'),
      'editor always renders the blockquote',
    )

    const user = userEvent.setup()
    await user.click(blockquote)
    await user.click(blockquote)
    await user.keyboard('!')

    await user.click(
      screen.getByRole('button', { name: 'simulate external update' }),
    )
    await user.keyboard('?')

    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(wrapper).toHaveAttribute('data-view-mode', 'view'),
    )

    await findEditorText('Overwritten from outside while editing.')
    expect(
      screen.queryByText('A blockquote at the very end.!?'),
    ).not.toBeInTheDocument()
  })
})
