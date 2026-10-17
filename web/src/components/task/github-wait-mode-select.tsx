import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@fohte/ui/select'

import type { GithubBlocker } from '#hooks/use-github-link'

export type GithubWaitMode = 'until-closed' | 'until-reply'

export function GithubWaitModeSelect({
  blocker,
  value,
  disabled,
  onChange,
}: {
  blocker: GithubBlocker
  value: GithubWaitMode
  disabled: boolean
  onChange: (mode: GithubWaitMode) => void
}) {
  return (
    <Select
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue === 'until-closed' || nextValue === 'until-reply') {
          onChange(nextValue)
        }
      }}
    >
      <SelectTrigger
        aria-label={`Wait mode for ${blocker.owner}/${blocker.repo}#${String(blocker.number)}`}
        variant="ghost"
        size="sm"
        disabled={disabled}
        className="w-32 shrink-0"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="until-closed">until closed</SelectItem>
        <SelectItem value="until-reply">until reply</SelectItem>
      </SelectContent>
    </Select>
  )
}
