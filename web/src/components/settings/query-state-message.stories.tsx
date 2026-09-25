import type { Meta, StoryObj } from '@storybook/react-vite'

import { QueryStateMessage } from '#components/settings/query-state-message'

const meta = {
  title: 'Settings/QueryStateMessage',
  component: QueryStateMessage,
} satisfies Meta<typeof QueryStateMessage>

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {
  name: 'a settings panel shows a loading message',
  args: {
    status: 'loading',
  },
}

export const ErrorState: Story = {
  name: 'a settings panel shows an error message',
  args: {
    status: 'error',
    message: 'データの取得に失敗しました',
  },
}

export const LoadingSmall: Story = {
  name: 'a compact settings panel shows a loading message',
  args: {
    status: 'loading',
    size: 'xs',
  },
}
