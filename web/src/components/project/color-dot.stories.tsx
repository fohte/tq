import type { Meta, StoryObj } from '@storybook/react-vite'
import { ColorDot } from '@web/components/project/color-dot'

const meta = {
  title: 'Project/ColorDot',
  component: ColorDot,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ColorDot>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    color: '#FF8400',
  },
}

export const NoColor: Story = {
  args: {
    color: null,
  },
}

export const Large: Story = {
  args: {
    color: '#4A90D9',
    size: 16,
  },
}

export const AllColors: Story = {
  args: {
    color: '#FF8400',
  },
  render: () => (
    <div className="flex items-center gap-3">
      <ColorDot color="#FF8400" />
      <ColorDot color="#FF5C33" />
      <ColorDot color="#4CAF50" />
      <ColorDot color="#4A90D9" />
      <ColorDot color="#9B59B6" />
      <ColorDot color="#26A69A" />
      <ColorDot color="#E91E63" />
      <ColorDot color="#FFC107" />
    </div>
  ),
}
