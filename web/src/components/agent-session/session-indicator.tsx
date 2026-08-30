import { Bot, Play, Square } from 'lucide-react'

import { SessionRow } from '#components/agent-session/session-row'
import {
  PreviewCard,
  PreviewCardPortal,
  PreviewCardPositioner,
  PreviewCardTrigger,
  PreviewListPopup,
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
          <PreviewListPopup label="SESSIONS" count={sessions.length}>
            {sessions.map((session) => (
              <SessionRow key={session.id} session={session} isDimmed={false} />
            ))}
          </PreviewListPopup>
        </PreviewCardPositioner>
      </PreviewCardPortal>
    </PreviewCard>
  )
}
