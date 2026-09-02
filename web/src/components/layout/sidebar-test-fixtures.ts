import type { SavedView } from '#hooks/use-saved-views'

export { makeLabel } from '#components/label/label-test-fixtures'
export { makeProject } from '#components/project/project-test-fixtures'
export { makeTask } from '#components/task/task-row-test-fixtures'

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
