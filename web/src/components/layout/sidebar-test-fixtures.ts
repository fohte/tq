import type { Label } from '#hooks/use-labels'
import type { SavedView } from '#hooks/use-saved-views'

export { makeProject } from '#components/project/project-test-fixtures'
export { makeTask } from '#components/task/task-row-test-fixtures'

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

export function makeSavedView(overrides: Partial<SavedView> = {}): SavedView {
  return {
    id: '00000000-0000-0000-0000-000000000201',
    name: 'Now',
    query: 'commitment:active',
    position: 0,
    context: 'personal',
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  }
}
