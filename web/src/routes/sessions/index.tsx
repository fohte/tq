import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import {
  type SessionFilterTab,
  SessionListToolbar,
} from '#components/agent-session/session-list-toolbar'
import { SessionRow } from '#components/agent-session/session-row'
import { ListAreaMessage } from '#components/ui/list-area-message'
import {
  isAgentSessionActive,
  useAgentSessions,
} from '#hooks/use-agent-sessions'
import { useContextFilter } from '#hooks/use-context-filter'
import { matchesContextFilter } from '#lib/context-filter'

export const Route = createFileRoute('/sessions/')({
  component: SessionsList,
})

function SessionsList() {
  const [filter, setFilter] = useState<SessionFilterTab>('all')
  const { mode } = useContextFilter()
  const { data: sessions, isLoading } = useAgentSessions()

  const filtered = sessions?.filter(
    (session) => filter === 'all' || isAgentSessionActive(session),
  )

  return (
    <div className="flex h-full flex-col">
      <SessionListToolbar filter={filter} onFilterChange={setFilter} />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <ListAreaMessage>Loading...</ListAreaMessage>
        ) : filtered && filtered.length > 0 ? (
          filtered.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              isDimmed={!matchesContextFilter(session.context, mode)}
            />
          ))
        ) : (
          <ListAreaMessage>No sessions</ListAreaMessage>
        )}
      </div>
    </div>
  )
}
