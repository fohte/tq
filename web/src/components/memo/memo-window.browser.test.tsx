import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MemoWindow } from '#components/memo/memo-window'
import { makeMemo } from '#hooks/memo-test-fixtures'
import { DEBOUNCED_SAVE_DELAY_MS } from '#hooks/use-debounced-save'
import type { SaveMemoInput } from '#hooks/use-memos'

vi.mock('#components/ui/markdown-editor', () => ({
  MarkdownEditor: (props: {
    defaultValue?: string
    onChange?: (content: string) => void
    placeholder?: string
  }) => (
    <textarea
      aria-label="memo editor"
      defaultValue={props.defaultValue}
      onChange={(event) => props.onChange?.(event.currentTarget.value)}
      placeholder={props.placeholder}
    />
  ),
}))

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function makeSaveHandler() {
  return vi.fn((input: SaveMemoInput) =>
    Promise.resolve(
      makeMemo({
        content: input.content,
        revision: input.revision + 1,
      }),
    ),
  )
}

describe('MemoWindow', () => {
  it('saves the full document after one second of inactivity', async () => {
    const onSave = makeSaveHandler()
    render(
      <MemoWindow
        context="work"
        memo={makeMemo({ content: 'Existing notes', revision: 2 })}
        onSave={onSave}
      />,
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'memo editor' }), {
      target: { value: '# Full notes\n\nA longer thought.' },
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCED_SAVE_DELAY_MS)
    })

    const getState = () => ({
      editorValue: screen.getByRole<HTMLTextAreaElement>('textbox', {
        name: 'memo editor',
      }).value,
      status: screen.getByText('Saved').textContent,
      saveCalls: onSave.mock.calls.map(([input]) => ({
        content: input.content,
        revision: input.revision,
        currentDraft: input.readCurrentDraft(),
      })),
    })
    expect(getState()).toEqual({
      editorValue: '# Full notes\n\nA longer thought.',
      status: 'Saved',
      saveCalls: [
        {
          content: '# Full notes\n\nA longer thought.',
          revision: 2,
          currentDraft: '# Full notes\n\nA longer thought.',
        },
      ],
    })
  })

  it('keeps the local draft when a refreshed memo arrives while editing', () => {
    const onSave = makeSaveHandler()
    const { rerender } = render(
      <MemoWindow
        context="work"
        memo={makeMemo({ content: 'A thought', revision: 1 })}
        onSave={onSave}
      />,
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'memo editor' }), {
      target: { value: 'My local draft' },
    })

    rerender(
      <MemoWindow
        context="work"
        memo={makeMemo({
          content: 'A thought from another window',
          revision: 2,
        })}
        onSave={onSave}
      />,
    )

    const getDraftState = () => ({
      editorValue: screen.getByRole<HTMLTextAreaElement>('textbox', {
        name: 'memo editor',
      }).value,
      status: screen.getByText('Unsaved').textContent,
    })
    expect(getDraftState()).toEqual({
      editorValue: 'My local draft',
      status: 'Unsaved',
    })
  })
})
