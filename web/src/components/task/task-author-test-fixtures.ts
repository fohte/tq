import type { AuthorInfo } from '#components/task/author-label'

export function makeAuthorInfo(
  overrides: Partial<AuthorInfo> = {},
): AuthorInfo {
  return {
    kind: 'human',
    agent: null,
    ...overrides,
  }
}
