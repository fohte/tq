import type { QueryClient } from '@tanstack/react-query'

import { makeProjectDetail } from '#components/project/project-test-fixtures'
import { makeResolveGithubUrlResult } from '#components/task/github-link-test-fixtures'
import { makeTaskPreview } from '#components/task/task-preview-test-fixtures'
import {
  githubUrlPreviewKeys,
  projectUrlPreviewKeys,
  taskPreviewKeys,
} from '#lib/query-keys'

export const CHECKLIST_ITEM_TASK_NUMBER = 7401
const CHECKLIST_ITEM_TASK_ID = '00000000-0000-4000-8000-000000000741'
export const CHECKLIST_ITEM_TASK_TITLE = 'Write sample release notes'
export const CHECKLIST_ITEM_GITHUB_URL =
  'https://github.com/example-org/sample-app/pull/14'
export const CHECKLIST_ITEM_GITHUB_TITLE = 'Add sample import flow'
const CHECKLIST_ITEM_PROJECT_ID = '00000000-0000-4000-8000-000000000742'
export const CHECKLIST_ITEM_PROJECT_TITLE = 'Sample project'

export function checklistItemTaskUrl(origin: string): string {
  return `${origin}/tasks/${CHECKLIST_ITEM_TASK_ID}`
}

export function checklistItemProjectUrl(origin: string): string {
  return `${origin}/projects/${CHECKLIST_ITEM_PROJECT_ID}`
}

export function seedChecklistItemMarkdownReferences(
  queryClient: QueryClient,
): void {
  const task = makeTaskPreview({
    id: CHECKLIST_ITEM_TASK_ID,
    number: CHECKLIST_ITEM_TASK_NUMBER,
    title: CHECKLIST_ITEM_TASK_TITLE,
    description: null,
  })

  queryClient.setQueryData(
    taskPreviewKeys.preview(String(CHECKLIST_ITEM_TASK_NUMBER)),
    task,
  )
  queryClient.setQueryData(
    taskPreviewKeys.preview(CHECKLIST_ITEM_TASK_ID),
    task,
  )
  queryClient.setQueryData(
    githubUrlPreviewKeys.preview(CHECKLIST_ITEM_GITHUB_URL),
    makeResolveGithubUrlResult({
      owner: 'example-org',
      repo: 'sample-app',
      number: 14,
      kind: 'pull_request',
      url: CHECKLIST_ITEM_GITHUB_URL,
      title: CHECKLIST_ITEM_GITHUB_TITLE,
    }),
  )
  queryClient.setQueryData(
    projectUrlPreviewKeys.preview(CHECKLIST_ITEM_PROJECT_ID),
    makeProjectDetail({
      id: CHECKLIST_ITEM_PROJECT_ID,
      title: CHECKLIST_ITEM_PROJECT_TITLE,
    }),
  )
}
