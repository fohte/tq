import { useCallback, useEffect, useState } from 'react'

import { useTaskDescriptionDraft } from '#components/task/create-task-modal-description'
import { useDescriptionTemplates } from '#hooks/use-description-templates'

export function useCreateTaskModalDescriptionTemplate(open: boolean) {
  const templatesQuery = useDescriptionTemplates({ enabled: open })
  const templates = templatesQuery.data ?? []
  const [selectedTemplateName, setSelectedTemplateName] = useState<
    string | null | undefined
  >(undefined)
  const [pendingTemplateName, setPendingTemplateName] = useState<
    string | null | undefined
  >(undefined)
  const [editorKey, setEditorKey] = useState(0)
  const selectedTemplate =
    selectedTemplateName == null
      ? undefined
      : templates.find((template) => template.name === selectedTemplateName)
  const templateBody = selectedTemplate?.body ?? ''
  const description = useTaskDescriptionDraft(templateBody)

  useEffect(() => {
    if (
      !open ||
      !templatesQuery.isSuccess ||
      selectedTemplateName !== undefined
    )
      return

    const defaultTemplate = templates.find((template) => template.isDefault)
    const initialTemplateName =
      description.getMarkdown().trim() === ''
        ? (defaultTemplate?.name ?? null)
        : null
    setSelectedTemplateName(initialTemplateName)
    if (initialTemplateName != null) setEditorKey((key) => key + 1)
  }, [
    description.getMarkdown,
    open,
    selectedTemplateName,
    templates,
    templatesQuery.isSuccess,
  ])

  const applyTemplate = useCallback(
    (templateName: string | null) => {
      const template =
        templateName == null
          ? undefined
          : templates.find((item) => item.name === templateName)
      setSelectedTemplateName(template?.name ?? null)
      setPendingTemplateName(undefined)
      description.reset(template?.body ?? '')
      setEditorKey((key) => key + 1)
    },
    [description.reset, templates],
  )

  const selectTemplate = useCallback(
    (templateName: string | null) => {
      if ((selectedTemplate?.name ?? null) === templateName) return

      if (description.getMarkdown().trim() === templateBody.trim()) {
        applyTemplate(templateName)
        return
      }

      setPendingTemplateName(templateName)
    },
    [
      applyTemplate,
      description.getMarkdown,
      selectedTemplate?.name,
      templateBody,
    ],
  )

  const confirmTemplateChange = useCallback(() => {
    if (pendingTemplateName === undefined) return
    applyTemplate(pendingTemplateName)
  }, [applyTemplate, pendingTemplateName])

  const cancelTemplateChange = useCallback(() => {
    setPendingTemplateName(undefined)
  }, [])

  const reset = useCallback(() => {
    setSelectedTemplateName(undefined)
    setPendingTemplateName(undefined)
    description.reset('')
    setEditorKey((key) => key + 1)
  }, [description.reset])

  return {
    ready: selectedTemplateName !== undefined || templatesQuery.isError,
    templates,
    selectedTemplateName: selectedTemplate?.name ?? null,
    pendingTemplateName,
    templateBody,
    editorKey,
    getDescription: description.getDescription,
    onChange: description.onChange,
    onFocusedDocumentChange: description.onFocusedDocumentChange,
    selectTemplate,
    confirmTemplateChange,
    cancelTemplateChange,
    reset,
  }
}
