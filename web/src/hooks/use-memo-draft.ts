import { useCallback, useEffect, useRef, useState } from 'react'

import { useDebouncedSave } from '#hooks/use-debounced-save'
import {
  appendMemoContent,
  type Memo,
  type SaveMemoInput,
} from '#hooks/use-memos'

interface UseMemoDraftOptions {
  memo: Memo | undefined
  onSave: (input: SaveMemoInput) => Promise<Memo>
  isLoading?: boolean
  loadError?: boolean
}

export function useMemoDraft({
  memo,
  onSave,
  isLoading = false,
  loadError = false,
}: UseMemoDraftOptions) {
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
  const replaceDraft = useCallback((content: string) => {
    draftRef.current = content
    setDraft(content)
    setEditorKey((key) => key + 1)
  }, [])
  const markClean = useCallback(() => {
    dirtyRef.current = false
    setIsDirty(false)
  }, [])

  useEffect(() => {
    if (dirtyRef.current || memo == null) return

    revisionRef.current = memo.revision
    if (draftRef.current === memo.content) return

    replaceDraft(memo.content)
  }, [memo?.content, memo?.revision, replaceDraft])

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
              replaceDraft(savedMemo.content)
            }
            markClean()
            return
          }

          if (conflictDraft !== undefined) {
            cancelScheduledSave()
            queuedSaveRef.current = null
            if (currentDraft === conflictDraft) {
              replaceDraft(savedMemo.content)
              markClean()
              return
            }

            const mergedDraft = appendMemoContent(
              savedMemo.content,
              currentDraft,
            )
            replaceDraft(mergedDraft)
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
    [cancelScheduledSave, markClean, replaceDraft],
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
    : loadError
      ? "Couldn't load"
      : isLoading
        ? 'Loading…'
        : isSaving
          ? 'Saving…'
          : isDirty
            ? 'Unsaved'
            : 'Saved'

  return { draft, editorKey, handleChange, status }
}
