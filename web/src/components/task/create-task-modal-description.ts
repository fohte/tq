import { useCallback, useRef } from 'react'

export const DEFAULT_TASK_DESCRIPTION = '## Why\n\n## What'

export function getTaskDescription(
  readMarkdown: (() => string) | null,
  fallbackMarkdown: string,
  defaultDescription?: string,
): string {
  const markdown = readMarkdown?.() ?? fallbackMarkdown
  const initialDescription = defaultDescription ?? DEFAULT_TASK_DESCRIPTION

  return markdown.trim() === initialDescription.trim() ? '' : markdown
}

export function useTaskDescriptionDraft(defaultDescription?: string) {
  const fallbackMarkdownRef = useRef('')
  const focusedMarkdownReaderRef = useRef<(() => string) | null>(null)

  const onChange = useCallback((markdown: string) => {
    fallbackMarkdownRef.current = markdown
  }, [])

  const onFocusedDocumentChange = useCallback((readMarkdown: () => string) => {
    focusedMarkdownReaderRef.current = readMarkdown
  }, [])

  const reset = useCallback(() => {
    fallbackMarkdownRef.current = ''
    focusedMarkdownReaderRef.current = null
  }, [])

  const getDescription = useCallback(
    () =>
      getTaskDescription(
        focusedMarkdownReaderRef.current,
        fallbackMarkdownRef.current,
        defaultDescription,
      ),
    [defaultDescription],
  )

  return { getDescription, onChange, onFocusedDocumentChange, reset }
}
