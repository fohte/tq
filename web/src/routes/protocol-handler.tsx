import { createFileRoute, redirect } from '@tanstack/react-router'

import { resolveProtocolHandlerTarget } from '#lib/protocol-handler'

interface ProtocolHandlerSearch {
  url?: string
}

function validateSearch(
  search: Record<string, unknown>,
): ProtocolHandlerSearch {
  return typeof search['url'] === 'string' ? { url: search['url'] } : {}
}

export const Route = createFileRoute('/protocol-handler')({
  validateSearch,
  beforeLoad: ({ search }) => {
    redirect({
      ...resolveProtocolHandlerTarget(search.url ?? ''),
      replace: true,
      throw: true,
    })
  },
})
