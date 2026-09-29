import type { AuthorInfo } from '#components/task/llm-author-label'

export function makeAuthorInfo(
  overrides: Partial<AuthorInfo> = {},
): AuthorInfo {
  return {
    kind: 'human',
    agent: null,
    ...overrides,
  }
}
