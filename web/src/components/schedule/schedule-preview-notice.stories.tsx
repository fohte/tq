import type { Meta, StoryObj } from '@storybook/react-vite'

import { SchedulePreviewNotice } from '#components/schedule/schedule-preview-notice'

const meta = {
  title: 'Schedule/SchedulePreviewNotice',
  component: SchedulePreviewNotice,
  args: { text: null, isLoading: false, isError: false },
} satisfies Meta<typeof SchedulePreviewNotice>

export default meta
type Story = StoryObj<typeof meta>

export const Preview: Story = {
  name: 'the preview explains the upcoming changes',
  args: {
    text: 'From Thu, Apr 18: 3 occurrences will change. Earlier events are unchanged.',
  },
}

export const Loading: Story = {
  name: 'the preview shows while an update is loading',
  args: { isLoading: true },
}

export const Unavailable: Story = {
  name: 'the preview explains when an update could not load',
  args: { isError: true },
}
