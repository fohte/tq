import type { Meta, StoryObj } from '@storybook/react-vite'

import { PageBreadcrumb } from '#components/task/page-breadcrumb'
import { makeTaskPage } from '#components/task/task-page-test-fixtures'

const samplePage = makeTaskPage({
  content: '## Discussion Points\n\n- Architecture review\n- Sprint planning',
})

const meta = {
  title: 'Task/PageBreadcrumb',
  component: PageBreadcrumb,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="flex h-10 w-full max-w-96 items-center gap-2.5 border-b border-border px-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PageBreadcrumb>

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {
  name: 'the breadcrumb indicates that page details are still loading.',
  args: {
    isLoading: true,
    taskNumber: undefined,
    page: undefined,
  },
}

export const NotFound: Story = {
  name: 'the breadcrumb indicates that the page could not be found.',
  args: {
    isLoading: false,
    taskNumber: undefined,
    page: undefined,
  },
}

export const Default: Story = {
  name: 'the breadcrumb links a page to its task number and title.',
  args: {
    isLoading: false,
    taskNumber: 42,
    page: samplePage,
  },
}

export const WithoutTaskNumber: Story = {
  name: 'the breadcrumb shows the page title without a task number.',
  args: {
    isLoading: false,
    taskNumber: undefined,
    page: samplePage,
  },
}
