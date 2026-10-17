import { Button } from '@fohte/ui/button'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Check } from 'lucide-react'
import { fn } from 'storybook/test'

import { GithubBlockerRowAppearance } from '#components/task/github-blocker-row-appearance'
import { makeGithubBlocker } from '#components/task/github-link-test-fixtures'

const meta = {
  title: 'Task/GithubBlockerRowAppearance',
  component: GithubBlockerRowAppearance,
  args: {
    onNotifyEventsChange: fn(),
    onRemove: fn(),
  },
} satisfies Meta<typeof GithubBlockerRowAppearance>

export default meta
type Story = StoryObj<typeof meta>

function waitModeControl(value: 'until-closed' | 'until-reply') {
  return (
    <select
      aria-label="Wait mode for example-team/sample-project#2048"
      defaultValue={value}
      className="h-7 w-32 shrink-0 border-0 bg-transparent p-0 font-mono text-xs text-muted-foreground underline decoration-border-strong underline-offset-2 focus-visible:ring-0"
    >
      <option value="until-closed">until closed</option>
      <option value="until-reply">until reply</option>
    </select>
  )
}

export const UntilClosed: Story = {
  name: 'the GitHub blocker waits until it is closed',
  args: {
    blocker: makeGithubBlocker(),
    waitModeControl: waitModeControl('until-closed'),
  },
}

export const UntilReply: Story = {
  name: 'the GitHub blocker waits for a reply',
  args: {
    blocker: makeGithubBlocker(),
    waitModeControl: waitModeControl('until-reply'),
  },
}

export const ReplyReceived: Story = {
  name: 'the GitHub blocker highlights a reply that needs acknowledgement',
  args: {
    blocker: makeGithubBlocker(),
    waitModeControl: waitModeControl('until-reply'),
    needsAcknowledgement: true,
    resolved: true,
    children: (
      <>
        <div className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted-foreground">
          <span className="font-mono text-xs text-primary">wait resolved</span>
          <span className="ml-auto text-muted-foreground-faint">
            resolved Oct 12
          </span>
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-0 shrink-0 justify-start whitespace-normal gap-0 rounded-none border-0 bg-transparent p-0 font-mono text-xs font-normal text-primary shadow-none transition-none hover:bg-transparent hover:text-primary active:translate-y-0"
            aria-label="Acknowledge wait: Review feedback"
            onClick={fn()}
          >
            <Check className="size-3.5" aria-hidden="true" />
            acknowledge
          </Button>
        </div>
        <div className="pl-5 font-sans text-sm leading-relaxed text-muted-foreground line-through">
          Review received
        </div>
      </>
    ),
  },
}
