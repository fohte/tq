import { Bot, Play, Square } from 'lucide-react'

import { SessionRow } from '#components/agent-session/session-row'
import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardPortal,
  PreviewCardPositioner,
  PreviewCardTrigger,
} from '#components/ui/preview-card'
import { isAgentSessionActive } from '#hooks/use-agent-sessions'
import type { TaskAgentSession } from '#hooks/use-task-agent-sessions'
import { cn } from '#lib/utils'

export function SessionIndicator({
  sessions,
}: {
  sessions: TaskAgentSession[]
}) {
  if (sessions.length === 0) return null

  const active = sessions.some((session) => isAgentSessionActive(session))

  return (
    <PreviewCard>
      <PreviewCardTrigger
        render={<span />}
        tabIndex={0}
        data-no-dnd=""
        data-testid="session-indicator"
        onClick={(e) => {
          // Nested inside the row's own <Link>: without this, a tap that
          // opens the card on mobile would also navigate the row away.
          e.preventDefault()
          e.stopPropagation()
        }}
        className="relative inline-flex size-5 shrink-0 cursor-default items-center justify-center"
      >
        <Bot
          className={cn(
            'size-4',
            active ? 'text-primary' : 'text-muted-foreground',
          )}
        />
        <span className="absolute right-0 bottom-0 flex items-center justify-center bg-background p-px">
          {active ? (
            <Play className="size-2 fill-primary text-primary" />
          ) : (
            <Square className="size-2 text-muted-foreground" strokeWidth={3} />
          )}
        </span>
      </PreviewCardTrigger>
      <PreviewCardPortal>
        <PreviewCardPositioner>
          {/* An explicit width (not `min-w-*` on `w-auto`) is required here:
              with `w-auto`, the popup's shrink-to-fit width is driven by its
              children's untruncated max-content width regardless of any
              min-width, since min-width only raises a floor and never caps
              growth. Set via inline style rather than an arbitrary Tailwind
              value, which the repo's eslint config disallows. */}
          <PreviewCardPopup
            className="p-0"
            style={{ width: 'min(28rem, calc(100vw - 2rem))' }}
          >
            <div className="border-b border-border px-3 py-1.5 font-mono text-2xs tracking-widest text-muted-foreground-faint">
              SESSIONS ({sessions.length})
            </div>
            {sessions.map((session) => (
              <SessionRow key={session.id} session={session} isDimmed={false} />
            ))}
          </PreviewCardPopup>
        </PreviewCardPositioner>
      </PreviewCardPortal>
    </PreviewCard>
  )
}
