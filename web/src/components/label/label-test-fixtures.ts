import type { Label } from '#hooks/use-labels'

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
