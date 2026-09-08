import type { Meta, StoryObj } from '@storybook/react-vite'

import { ServiceWorkerPanel } from '#components/settings/service-worker-panel'

const meta = {
  title: 'Settings/ServiceWorkerPanel',
  component: ServiceWorkerPanel,
  args: {
    onReinstall: () => {},
  },
  render: (args) => (
    <div className="w-full max-w-3xl">
      <ServiceWorkerPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof ServiceWorkerPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
