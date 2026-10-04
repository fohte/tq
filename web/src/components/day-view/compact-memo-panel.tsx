import '#components/day-view/compact-memo-panel.css'

import { useCallback, useEffect, useRef, useState } from 'react'

import { MarkdownEditor } from '#components/ui/markdown-editor'
import { useDebouncedSave } from '#hooks/use-debounced-save'
import {
  appendMemoContent,
  type Memo,
  type MemoContext,
  type SaveMemoInput,
} from '#hooks/use-memos'

interface CompactMemoPanelProps {
  context: MemoContext
  memo: Memo | undefined
  onSave: (input: SaveMemoInput) => Promise<Memo>
}

export function CompactMemoPanel({
  context,
  memo,
  onSave,
}: CompactMemoPanelProps) {
  const initialContent = memo?.content ?? ''
  const initialRevision = memo?.revision ?? 0
  const [draft, setDraft] = useState(initialContent)
  const [editorKey, setEditorKey] = useState(0)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const draftRef = useRef(initialContent)
  const revisionRef = useRef(initialRevision)
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const saveErrorRef = useRef(false)
  const queuedSaveRef = useRef<string | null>(null)
  const onSaveRef = useRef(onSave)
  const saveRef = useRef<(content: string) => void>(() => {})
  onSaveRef.current = onSave
  const { onChange: scheduleSave, cancel: cancelScheduledSave } =
    useDebouncedSave((content) => {
      saveRef.current(content)
    })

  useEffect(() => {
    if (dirtyRef.current || memo == null) return

    revisionRef.current = memo.revision
    if (draftRef.current === memo.content) return

    draftRef.current = memo.content
    setDraft(memo.content)
    setEditorKey((key) => key + 1)
  }, [memo?.content, memo?.revision])

  const save = useCallback(
    (content: string) => {
      if (savingRef.current) {
        queuedSaveRef.current = content
        return
      }

      savingRef.current = true
      setIsSaving(true)
      const submittedContent = content
      const submittedRevision = revisionRef.current
      let conflictDraft: string | undefined

      void onSaveRef
        .current({
          content: submittedContent,
          revision: submittedRevision,
          readCurrentDraft: () => {
            conflictDraft = draftRef.current
            return conflictDraft
          },
        })
        .then((savedMemo) => {
          revisionRef.current = savedMemo.revision
          saveErrorRef.current = false
          setSaveError(false)

          const currentDraft = draftRef.current
          if (
            currentDraft === submittedContent &&
            (conflictDraft === undefined || conflictDraft === currentDraft)
          ) {
            cancelScheduledSave()
            queuedSaveRef.current = null
            if (savedMemo.content !== currentDraft) {
              draftRef.current = savedMemo.content
              setDraft(savedMemo.content)
              setEditorKey((key) => key + 1)
            }
            dirtyRef.current = false
            setIsDirty(false)
            return
          }

          if (conflictDraft !== undefined) {
            cancelScheduledSave()
            queuedSaveRef.current = null
            if (currentDraft === conflictDraft) {
              draftRef.current = savedMemo.content
              setDraft(savedMemo.content)
              setEditorKey((key) => key + 1)
              dirtyRef.current = false
              setIsDirty(false)
              return
            }

            const mergedDraft = appendMemoContent(
              savedMemo.content,
              currentDraft,
            )
            draftRef.current = mergedDraft
            setDraft(mergedDraft)
            setEditorKey((key) => key + 1)
            queuedSaveRef.current = mergedDraft
          }
        })
        .catch(() => {
          queuedSaveRef.current = null
          saveErrorRef.current = true
          setSaveError(true)
        })
        .finally(() => {
          savingRef.current = false
          setIsSaving(false)
          if (saveErrorRef.current || queuedSaveRef.current == null) return

          const queuedContent = queuedSaveRef.current
          queuedSaveRef.current = null
          saveRef.current(queuedContent)
        })
    },
    [cancelScheduledSave],
  )

  saveRef.current = save

  const handleChange = useCallback(
    (content: string) => {
      if (!dirtyRef.current) {
        revisionRef.current = memo?.revision ?? revisionRef.current
        dirtyRef.current = true
        setIsDirty(true)
      }
      draftRef.current = content
      setDraft(content)
      saveErrorRef.current = false
      setSaveError(false)
      scheduleSave(content)
    },
    [memo?.revision, scheduleSave],
  )

  const status = saveError
    ? "Couldn't save"
    : isSaving
      ? 'Saving…'
      : isDirty
        ? 'Unsaved'
        : 'Saved'
  const title = context === 'work' ? 'Work memo' : 'Personal memo'

  return (
    <section className="flex shrink-0 flex-col border-t border-border bg-background px-2 pb-2 pt-1">
      <div className="flex h-6 items-center justify-between gap-2">
        <h2 className="text-xs font-medium text-foreground">{title}</h2>
        <span aria-live="polite" className="text-2xs text-muted-foreground">
          {status}
        </span>
      </div>
      <div className="h-18 shrink-0 overflow-y-auto rounded-md border border-border bg-card">
        <div aria-label={title} className="compact-memo-editor" role="group">
          <MarkdownEditor
            key={editorKey}
            defaultValue={draft}
            onChange={handleChange}
            placeholder="Add a note..."
            size="fit"
          />
        </div>
      </div>
    </section>
  )
}
