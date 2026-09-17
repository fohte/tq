import type { QueryClient } from '@tanstack/react-query'

import { makeResolveGithubUrlResult } from '#components/task/github-link-test-fixtures'
import { makeTaskDetail } from '#components/task/task-row-test-fixtures'
import { githubUrlPreviewKeys } from '#hooks/use-github-url-preview'
import { taskMentionKeys } from '#hooks/use-task-mentions'

export const MENTION_FIXTURE_NUMBER = 9101
export const GITHUB_URL_FIXTURE = 'https://github.com/fohte/tq/issues/9102'
export const MENTION_FIXTURE_TITLE = 'Investigate flaky auth test suite'
export const GITHUB_URL_FIXTURE_TITLE =
  'Support live-preview chips and autocomplete for task mentions'

// Seeds the query cache the decoration plugin's chips render through (see
// plugin.tsx's `createChipWidgetComponent`), so both providers resolve their
// chip synchronously instead of via a real network round-trip.
export function seedLiveReferenceFixtures(queryClient: QueryClient): void {
  const task = makeTaskDetail({
    id: '00000000-0000-0000-0000-000000000099',
    number: MENTION_FIXTURE_NUMBER,
    title: MENTION_FIXTURE_TITLE,
    description: null,
    startDate: null,
    dueDate: null,
    estimatedMinutes: null,
  })
  queryClient.setQueryData(
    taskMentionKeys.preview(MENTION_FIXTURE_NUMBER),
    task,
  )

  queryClient.setQueryData(
    githubUrlPreviewKeys.preview(GITHUB_URL_FIXTURE),
    makeResolveGithubUrlResult({
      number: 9102,
      url: GITHUB_URL_FIXTURE,
      title: GITHUB_URL_FIXTURE_TITLE,
    }),
  )
}
