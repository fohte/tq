import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GithubSyncRuleFormModal } from '#components/settings/github-sync-rule-form-modal'
import { sampleProjects } from '#components/settings/sync-rule-test-fixtures'
import {
  useCreateGithubSyncRule,
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
    useUpdateGithubSyncRule: vi.fn(),
  }
})

vi.mock('#hooks/use-projects', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-projects')>()
  return { ...original, useProjects: vi.fn() }
})

const mockUseCreateGithubSyncRule = vi.mocked(useCreateGithubSyncRule)
const mockUseUpdateGithubSyncRule = vi.mocked(useUpdateGithubSyncRule)
const mockUseProjects = vi.mocked(useProjects)

const scopeLabels = ['すべて', 'Organization', 'リポジトリ'] as const

function getScopeState() {
  return {
    selectedScope:
      scopeLabels.find(
        (label) =>
          screen
            .getByRole('button', { name: label })
            .getAttribute('aria-pressed') === 'true',
      ) ?? null,
    organizationFieldVisible: screen.queryByPlaceholderText('octocat') != null,
    repositoryFieldVisible:
      screen.queryByPlaceholderText('hello-world') != null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseCreateGithubSyncRule.mockReturnValue(
    partialMutation<ReturnType<typeof useCreateGithubSyncRule>>({
      mutate: vi.fn(),
      isPending: false,
    }),
  )
  mockUseUpdateGithubSyncRule.mockReturnValue(
    partialMutation<ReturnType<typeof useUpdateGithubSyncRule>>({
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

describe('GithubSyncRuleFormModal', () => {
  it('shows the fields required by the selected repository scope', async () => {
    const user = userEvent.setup()
    render(<GithubSyncRuleFormModal open onOpenChange={vi.fn()} />)

    const states = [getScopeState()]
    await user.click(screen.getByRole('button', { name: 'Organization' }))
    states.push(getScopeState())
    await user.click(screen.getByRole('button', { name: 'リポジトリ' }))
    states.push(getScopeState())
    await user.click(screen.getByRole('button', { name: 'すべて' }))
    states.push(getScopeState())

    expect(states).toEqual([
      {
        selectedScope: 'すべて',
        organizationFieldVisible: false,
        repositoryFieldVisible: false,
      },
      {
        selectedScope: 'Organization',
        organizationFieldVisible: true,
        repositoryFieldVisible: false,
      },
      {
        selectedScope: 'リポジトリ',
        organizationFieldVisible: true,
        repositoryFieldVisible: true,
      },
      {
        selectedScope: 'すべて',
        organizationFieldVisible: false,
        repositoryFieldVisible: false,
      },
    ])
  })
})
