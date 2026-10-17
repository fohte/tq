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
    <select
      aria-label={`Wait mode for ${blocker.owner}/${blocker.repo}#${String(blocker.number)}`}
      value={value}
      disabled={disabled}
      onChange={(event) => {
        onChange(
          event.target.value === 'until-reply' ? 'until-reply' : 'until-closed',
        )
      }}
      className="h-7 w-32 shrink-0 border-0 bg-transparent p-0 font-mono text-xs text-muted-foreground underline decoration-border-strong underline-offset-2 focus-visible:ring-0"
    >
      <option value="until-closed">until closed</option>
      <option value="until-reply">until reply</option>
    </select>
  )
}
