import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { fn } from 'storybook/test'

import { makeDescriptionTemplate } from '#components/settings/description-template-test-fixtures'
import { CreateTaskModalDescriptionTemplateSelector } from '#components/task/create-task-modal-description-template-selector'
import { CreateTaskModalMobile } from '#components/task/create-task-modal-mobile'
import { MarkdownEditor } from '#components/ui/markdown-editor'

const featureTemplate = makeDescriptionTemplate({
  name: 'Feature work',
  whenToUse: 'Use when adding a user-facing capability.',
  body: '## Goal\n\n## Steps\n\n## Verification',
})

const templates = [
  featureTemplate,
  makeDescriptionTemplate({
    id: 'description-template-2',
    name: 'Quick note',
    whenToUse: 'Use when capturing a short follow-up.',
    body: '## Summary',
    isDefault: false,
  }),
]

function CreateTaskModalMobileStoryProvider({
  children,
}: {
  children: ReactNode
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <div className="dark min-h-screen bg-background">
        <div className="fixed inset-0 bg-black/40" />
        {children}
      </div>
    </QueryClientProvider>
  )
}

const meta = {
  title: 'Task/CreateTaskModalMobile',
  component: CreateTaskModalMobile,
  parameters: {
    layout: 'fullscreen',
    overflowCheck: { ignoreSelectors: ['.overflow-x-auto'] },
    msw: {
      handlers: [
        http.get('/api/labels', () => HttpResponse.json([])),
        http.get('/api/tasks/mentions', () => HttpResponse.json([])),
      ],
    },
  },
  tags: ['mobile-only'],
  decorators: [
    (Story) => (
      <CreateTaskModalMobileStoryProvider>
        <Story />
      </CreateTaskModalMobileStoryProvider>
    ),
  ],
  args: {
    parentIndicator: null,
    githubIndicator: null,
    descriptionTemplateSelector: (
      <CreateTaskModalDescriptionTemplateSelector
        templates={templates}
        selectedTemplateName="Feature work"
        loadError={false}
        onChange={fn()}
      />
    ),
    descriptionEditor: (
      <MarkdownEditor
        defaultValue={featureTemplate.body}
        placeholder="Add description..."
        size="compact"
      />
    ),
    title: '',
    setTitle: fn(),
    startDate: '',
    setStartDate: fn(),
    dueDate: '',
    setDueDate: fn(),
    estimateInput: '',
    setEstimateInput: fn(),
    estimateLabel: 'Estimate',
    estimateActive: false,
    context: '',
    setContext: fn(),
    commitment: '',
    setCommitment: fn(),
    plan: '',
    setPlan: fn(),
    labels: [],
    setLabels: fn(),
    handleOpenChange: fn(),
    handleSubmit: fn(),
    submitDisabled: true,
  },
} satisfies Meta<typeof CreateTaskModalMobile>

export default meta
type Story = StoryObj<typeof meta>

export const WithDescriptionTemplate: Story = {
  name: 'the mobile sheet offers templates between the title and description',
}
