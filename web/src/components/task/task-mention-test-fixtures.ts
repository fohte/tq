import type { MentionSuggestion } from '#hooks/use-task-mentions'

export function makeMentionSuggestion(
  overrides: Partial<MentionSuggestion> = {},
): MentionSuggestion {
  return {
    id: '1',
    number: 12,
    title: 'Deploy to production',
    status: 'todo',
    ...overrides,
  }
}
