import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeGithubLink } from '#components/task/github-link-test-fixtures'
import { TaskGithubLinksSection } from '#components/task/task-github-links-section'
import {
  useUnlinkTaskFromGithub,
  useUpdateGithubLinkNotifyEvents,
} from '#hooks/use-github-link'
import { partialMutation } from '#lib/test-utils'
import { createStoryRouter } from '#storybook-config/story-router'

vi.mock('#hooks/use-github-link', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-github-link')>()
  return {
    ...original,
    useUnlinkTaskFromGithub: vi.fn(),
    useUpdateGithubLinkNotifyEvents: vi.fn(),
  }
})

const mockUseUnlinkTaskFromGithub = vi.mocked(useUnlinkTaskFromGithub)
const mockUseUpdateGithubLinkNotifyEvents = vi.mocked(
  useUpdateGithubLinkNotifyEvents,
)

const taskId = '00000000-0000-0000-0000-000000000001'
const link = makeGithubLink({
  id: 'link-example',
  owner: 'example',
  repo: 'repository',
  number: 7319,
  url: 'https://github.com/example/repository/issues/7319',
  notifyEvents: ['closed'],
})

function getPickerState(picker: HTMLElement, unlink: HTMLElement) {
  return {
    pickerLabel: picker.getAttribute('aria-label'),
    pickerComesBeforeUnlink:
      (picker.compareDocumentPosition(unlink) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
      0,
  }
}

async function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createStoryRouter({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <TaskGithubLinksSection taskId={taskId} githubLinks={[link]} />
      </QueryClientProvider>
    ),
    paths: ['/tasks/$taskId'],
  })
  await router.load()

  return render(<RouterProvider router={router} />)
}

describe('TaskGithubLinksSection', () => {
  const update =
    vi.fn<ReturnType<typeof useUpdateGithubLinkNotifyEvents>['mutate']>()

  beforeEach(() => {
    update.mockReset()
    mockUseUnlinkTaskFromGithub.mockReturnValue(
      partialMutation<ReturnType<typeof useUnlinkTaskFromGithub>>({
        mutate: vi.fn(),
        isPending: false,
      }),
    )
    mockUseUpdateGithubLinkNotifyEvents.mockReturnValue(
      partialMutation<ReturnType<typeof useUpdateGithubLinkNotifyEvents>>({
        mutate: update,
        isPending: false,
      }),
    )
  })

  it('shows the current notification selection before the unlink action', async () => {
    await renderSection()

    const picker = screen.getByRole('button', { name: 'Notify on: closed' })
    const unlink = screen.getByRole('button', {
      name: 'Unlink example/repository#7319',
    })

    expect(getPickerState(picker, unlink)).toEqual({
      pickerLabel: 'Notify on: closed',
      pickerComesBeforeUnlink: true,
    })
  })

  it('saves notification events for the selected GitHub link', async () => {
    const user = userEvent.setup()
    await renderSection()

    await user.click(screen.getByRole('button', { name: 'Notify on: closed' }))
    await user.click(
      await screen.findByRole('menuitemcheckbox', { name: 'new comments' }),
    )

    expect(update.mock.calls.map(([variables]) => variables)).toEqual([
      { linkId: 'link-example', notifyEvents: ['closed', 'comments'] },
    ])
  })
})
