import { useCallback, useRef } from 'react'

function getTaskDescription(markdown: string, templateBody: string): string {
  return markdown.trim() === templateBody.trim() ? '' : markdown
}

export function useTaskDescriptionDraft(templateBody: string) {
  const fallbackMarkdownRef = useRef(templateBody)
  const focusedMarkdownReaderRef = useRef<(() => string) | null>(null)
  const templateBodyRef = useRef(templateBody)

  if (templateBodyRef.current !== templateBody) {
    if (
      focusedMarkdownReaderRef.current === null &&
      fallbackMarkdownRef.current.trim() === templateBodyRef.current.trim()
    ) {
      fallbackMarkdownRef.current = templateBody
    }
    templateBodyRef.current = templateBody
  }

  const onChange = useCallback((markdown: string) => {
    fallbackMarkdownRef.current = markdown
  }, [])

  const onFocusedDocumentChange = useCallback((readMarkdown: () => string) => {
    focusedMarkdownReaderRef.current = readMarkdown
  }, [])

  const getMarkdown = useCallback(
    () => focusedMarkdownReaderRef.current?.() ?? fallbackMarkdownRef.current,
    [],
  )

  const reset = useCallback((markdown: string) => {
    fallbackMarkdownRef.current = markdown
    focusedMarkdownReaderRef.current = null
  }, [])

  const getDescription = useCallback(
    () => getTaskDescription(getMarkdown(), templateBody),
    [getMarkdown, templateBody],
  )

  return {
    getDescription,
    getMarkdown,
    onChange,
    onFocusedDocumentChange,
    reset,
  }
}
