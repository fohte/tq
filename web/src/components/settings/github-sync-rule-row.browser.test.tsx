import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GithubSyncRuleRow } from '#components/settings/github-sync-rule-row'
import {
  makeSyncRule,
  sampleProjects,
} from '#components/settings/sync-rule-test-fixtures'
import {
  useCreateGithubSyncRule,
  useDeleteGithubSyncRule,
  useUpdateGithubSyncRule,
} from '#hooks/use-github-sync-rules'
import { useProjects } from '#hooks/use-projects'
import { partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-github-sync-rules', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-github-sync-rules')>()
  return {
    ...original,
    useCreateGithubSyncRule: vi.fn(),
    useDeleteGithubSyncRule: vi.fn(),
    useUpdateGithubSyncRule: vi.fn(),
  }
})

vi.mock('#hooks/use-projects', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-projects')>()
  return { ...original, useProjects: vi.fn() }
})

const mockUseCreateGithubSyncRule = vi.mocked(useCreateGithubSyncRule)
const mockUseDeleteGithubSyncRule = vi.mocked(useDeleteGithubSyncRule)
const mockUseUpdateGithubSyncRule = vi.mocked(useUpdateGithubSyncRule)
const mockUseProjects = vi.mocked(useProjects)

beforeEach(() => {
  vi.clearAllMocks()
  mockUseCreateGithubSyncRule.mockReturnValue(
    partialMutation<ReturnType<typeof useCreateGithubSyncRule>>({
      mutate: vi.fn(),
      isPending: false,
    }),
  )
  mockUseDeleteGithubSyncRule.mockReturnValue(
    partialMutation<ReturnType<typeof useDeleteGithubSyncRule>>({
      mutate: vi.fn(),
      isPending: false,
    }),
  )
  mockUseProjects.mockReturnValue(
    partialMutation<ReturnType<typeof useProjects>>({
      isLoading: false,
      isSuccess: true,
      data: sampleProjects,
    }),
  )
})

describe('GithubSyncRuleRow', () => {
  it('updates the rule when it is disabled', async () => {
    const mutate = vi.fn<ReturnType<typeof useUpdateGithubSyncRule>['mutate']>()
    mockUseUpdateGithubSyncRule.mockReturnValue(
      partialMutation<ReturnType<typeof useUpdateGithubSyncRule>>({
        mutate,
        isPending: false,
      }),
    )
    const user = userEvent.setup()
    render(
      <GithubSyncRuleRow
        rule={makeSyncRule({ id: 'sync-rule-example', enabled: true })}
        projects={sampleProjects}
      />,
    )

    await user.click(screen.getByRole('button', { name: '無効' }))

    expect(mutate.mock.calls.map(([input]) => input)).toEqual([
      { id: 'sync-rule-example', input: { enabled: false } },
    ])
  })
})
