import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@fohte/ui/select'

import type { GithubBlocker } from '#hooks/use-github-link'
import { selectValueHandler } from '#lib/form-utils'

const waitModeOptions = [
  { value: 'until-closed', label: 'until closed' },
  { value: 'until-reply', label: 'until reply' },
] as const
export type GithubWaitMode = (typeof waitModeOptions)[number]['value']
const waitModeValues = waitModeOptions.map(({ value }) => value)

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
      items={waitModeOptions}
      value={value}
      onValueChange={selectValueHandler(onChange, waitModeValues)}
    >
      <SelectTrigger
        aria-label={`Wait mode for ${blocker.owner}/${blocker.repo}#${String(blocker.number)}`}
        variant="ghost"
        size="sm"
        disabled={disabled}
        className="w-32 shrink-0"
      >
        <span className="font-mono text-xs">
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {waitModeOptions.map(({ value: optionValue, label }) => (
          <SelectItem key={optionValue} value={optionValue}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
