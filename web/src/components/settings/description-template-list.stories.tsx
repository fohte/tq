import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { delay, http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'

import { DescriptionTemplateList } from '#components/settings/description-template-list'
import { makeDescriptionTemplate } from '#components/settings/description-template-test-fixtures'
import {
  type DescriptionTemplate,
  descriptionTemplateKeys,
} from '#hooks/use-description-templates'

const sampleTemplates: DescriptionTemplate[] = [
  makeDescriptionTemplate({
    id: 'template-id-1',
    name: 'Sample template',
    whenToUse: 'Use when work has a clear outcome.',
    body: '## Goal\n\n## Outcome',
    guide: 'Describe the goal and the expected outcome.',
    isDefault: true,
  }),
  makeDescriptionTemplate({
    id: 'template-id-2',
    name: 'Review template',
    whenToUse: 'Use when reviewing existing work.',
    body: '## Scope\n\n## Findings',
    guide: 'Describe the scope and list the findings.',
    isDefault: false,
  }),
]

function Providers({
  children,
  templates,
}: {
  children: ReactNode
  templates?: DescriptionTemplate[] | undefined
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  if (templates !== undefined) {
    queryClient.setQueryData(descriptionTemplateKeys.list(), templates)
  }

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function WrappedDescriptionTemplateList({
  templates,
}: {
  templates?: DescriptionTemplate[] | undefined
}) {
  return (
    <Providers templates={templates}>
      <div className="w-full max-w-3xl">
        <DescriptionTemplateList />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Settings/DescriptionTemplateList',
  component: WrappedDescriptionTemplateList,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof WrappedDescriptionTemplateList>

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {
  name: 'the description template list shows a loading message',
  args: {},
  parameters: {
    msw: {
      handlers: [
        http.get('/api/description-templates', async () => {
          await delay('infinite')
          return HttpResponse.json([])
        }),
      ],
    },
  },
}

export const Empty: Story = {
  name: 'the description template list explains that no templates exist',
  args: {
    templates: [],
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/description-templates', () => HttpResponse.json([])),
      ],
    },
  },
}

export const Populated: Story = {
  name: 'the description template list shows configured templates',
  args: {
    templates: sampleTemplates,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/description-templates', () =>
          HttpResponse.json(sampleTemplates),
        ),
      ],
    },
  },
}
