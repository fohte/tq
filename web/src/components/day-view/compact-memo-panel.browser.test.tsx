import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CompactMemoPanel } from '#components/day-view/compact-memo-panel'
import { makeMemo } from '#hooks/memo-test-fixtures'
import { DEBOUNCED_SAVE_DELAY_MS } from '#hooks/use-debounced-save'
import type { Memo, SaveMemoInput } from '#hooks/use-memos'

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

function makeDeferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return {
    promise,
    resolve: (value: T) => {
      resolve(value)
    },
  }
}

function readSaveCalls(save: ReturnType<typeof makeSaveHandler>) {
  return save.mock.calls.map(([input]) => ({
    content: input.content,
    revision: input.revision,
    currentDraft: input.readCurrentDraft(),
  }))
}

function getEditorValue(): string | null {
  const editor = screen.getByRole('textbox', { name: 'memo editor' })
  return editor instanceof HTMLTextAreaElement ? editor.value : null
}

function panelState(
  editorValue: string | null,
  status: string | null,
  saveCalls: ReturnType<typeof readSaveCalls>,
) {
  return { editorValue, status, saveCalls }
}

function saveFrames(
  beforeDelay: ReturnType<typeof readSaveCalls>,
  afterDelay: ReturnType<typeof readSaveCalls>,
) {
  return { beforeDelay, afterDelay }
}

describe('CompactMemoPanel', () => {
  it('keeps the local draft when a refreshed memo arrives while editing', async () => {
    const onSave = makeSaveHandler()
    const { rerender } = render(
      <CompactMemoPanel
        context="work"
        memo={makeMemo({ content: 'A thought', revision: 1 })}
        onSave={onSave}
      />,
    )
    const editor = screen.getByRole('textbox', { name: 'memo editor' })
    fireEvent.change(editor, { target: { value: 'My local draft' } })

    rerender(
      <CompactMemoPanel
        context="work"
        memo={makeMemo({ content: 'A thought from dot', revision: 2 })}
        onSave={onSave}
      />,
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCED_SAVE_DELAY_MS)
    })

    expect(
      panelState(
        getEditorValue(),
        screen.getByText('Saved').textContent,
        readSaveCalls(onSave),
      ),
    ).toEqual(
      panelState('My local draft', 'Saved', [
        {
          content: 'My local draft',
          revision: 1,
          currentDraft: 'My local draft',
        },
      ]),
    )
  })

  it('saves after one second of inactivity', async () => {
    const onSave = makeSaveHandler()
    render(
      <CompactMemoPanel
        context="work"
        memo={makeMemo({ revision: 1 })}
        onSave={onSave}
      />,
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'memo editor' }), {
      target: { value: 'A new note' },
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCED_SAVE_DELAY_MS - 1)
    })
    const callsBeforeDelay = readSaveCalls(onSave)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })

    expect(saveFrames(callsBeforeDelay, readSaveCalls(onSave))).toEqual(
      saveFrames(
        [],
        [
          {
            content: 'A new note',
            revision: 1,
            currentDraft: 'A new note',
          },
        ],
      ),
    )
  })

  it('keeps an edit already appended by conflict recovery without saving it twice', async () => {
    const pendingSave = makeDeferred<ReturnType<typeof makeMemo>>()
    const onSave = vi.fn((input: SaveMemoInput) =>
      pendingSave.promise.then((memo) =>
        makeMemo({
          ...memo,
          content: `${memo.content}\n\n${input.readCurrentDraft()}`,
        }),
      ),
    )
    render(
      <CompactMemoPanel
        context="work"
        memo={makeMemo({ content: 'An existing note', revision: 1 })}
        onSave={onSave}
      />,
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'memo editor' }), {
      target: { value: 'The first draft' },
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCED_SAVE_DELAY_MS)
    })

    fireEvent.change(screen.getByRole('textbox', { name: 'memo editor' }), {
      target: { value: 'The latest draft' },
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCED_SAVE_DELAY_MS)
    })
    pendingSave.resolve(makeMemo({ content: 'A note from dot', revision: 4 }))
    await act(async () => {
      await pendingSave.promise
    })

    expect(
      panelState(
        getEditorValue(),
        screen.getByText('Saved').textContent,
        readSaveCalls(onSave),
      ),
    ).toEqual(
      panelState('A note from dot\n\nThe latest draft', 'Saved', [
        {
          content: 'The first draft',
          revision: 1,
          currentDraft: 'A note from dot\n\nThe latest draft',
        },
      ]),
    )
  })

  it('preserves an edit made after conflict recovery reads the draft', async () => {
    const initialAttempt = makeDeferred<Memo>()
    const conflictRetry = makeDeferred<Memo>()
    const secondSave = makeDeferred<Memo>()
    const recoveryDraftRead = makeDeferred<string>()
    let saveCount = 0
    const onSave = vi.fn((input: SaveMemoInput) => {
      saveCount += 1
      if (saveCount > 1) return secondSave.promise

      return initialAttempt.promise.then(() => {
        recoveryDraftRead.resolve(input.readCurrentDraft())
        return conflictRetry.promise
      })
    })
    render(
      <CompactMemoPanel
        context="work"
        memo={makeMemo({ content: 'An existing note', revision: 1 })}
        onSave={onSave}
      />,
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'memo editor' }), {
      target: { value: 'The submitted draft' },
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCED_SAVE_DELAY_MS)
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'memo editor' }), {
      target: { value: 'The draft read during recovery' },
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCED_SAVE_DELAY_MS)
    })

    initialAttempt.resolve(
      makeMemo({ content: 'A note from dot', revision: 3 }),
    )
    await act(async () => {
      await recoveryDraftRead.promise
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'memo editor' }), {
      target: { value: 'The submitted draft' },
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCED_SAVE_DELAY_MS)
    })

    conflictRetry.resolve(
      makeMemo({
        content: 'A note from dot\n\nThe draft read during recovery',
        revision: 4,
      }),
    )
    await act(async () => {
      await conflictRetry.promise
      await Promise.resolve()
    })
    secondSave.resolve(
      makeMemo({
        content:
          'A note from dot\n\nThe draft read during recovery\n\nThe submitted draft',
        revision: 5,
      }),
    )
    await act(async () => {
      await secondSave.promise
    })

    const preservedDraft =
      'A note from dot\n\nThe draft read during recovery\n\nThe submitted draft'
    expect(
      panelState(
        getEditorValue(),
        screen.getByText('Saved').textContent,
        readSaveCalls(onSave),
      ),
    ).toEqual(
      panelState(preservedDraft, 'Saved', [
        {
          content: 'The submitted draft',
          revision: 1,
          currentDraft: preservedDraft,
        },
        {
          content: preservedDraft,
          revision: 4,
          currentDraft: preservedDraft,
        },
      ]),
    )
  })
})
