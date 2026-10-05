import type { QueryClient } from '@tanstack/react-query'

import type { Label } from '#hooks/use-labels'
import { labelKeys } from '#lib/query-keys'

export function makeLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: '00000000-0000-0000-0000-000000000301',
    name: 'urgent',
    color: null,
    context: 'personal',
    createdAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  }
}

export function seedContextLabels(queryClient: QueryClient): void {
  queryClient.setQueryData(labelKeys.list({ context: 'work' }), [
    makeLabel({ id: 'work-label', name: 'work-only', context: 'work' }),
  ])
  queryClient.setQueryData(labelKeys.list({ context: 'personal' }), [
    makeLabel({ id: 'personal-label', name: 'personal-only' }),
  ])
}
