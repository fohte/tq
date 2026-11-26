import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { ProjectFieldsManager } from '#components/project/project-fields-manager'

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function ProjectFieldsManagerStory(
  props: React.ComponentProps<typeof ProjectFieldsManager>,
) {
  return (
    <Providers>
      <div className="w-64">
        <ProjectFieldsManager {...props} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Project/ProjectDetail/FieldsManager',
  component: ProjectFieldsManagerStory,
  parameters: {
    layout: 'centered',
  },
  args: {
    projectId: 'project-a',
  },
} satisfies Meta<typeof ProjectFieldsManagerStory>

export default meta
type Story = StoryObj<typeof meta>

export const Desktop: Story = {
  name: 'the desktop sidebar shows the fields management entry',
}

export const Mobile: Story = {
  name: 'the mobile sidebar shows the fields management entry',
  args: {
    mobileLayout: true,
  },
}
