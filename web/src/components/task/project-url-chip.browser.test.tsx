import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { makeProjectDetail } from '#components/project/project-test-fixtures'
import { ProjectUrlChip } from '#components/task/project-url-chip'
import { projectUrlPreviewKeys } from '#hooks/use-project-url-preview'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({
      children,
      to,
      params,
      ...props
    }: {
      children: React.ReactNode
      to?: string
      params?: Record<string, unknown>
    } & Record<string, unknown>) => (
      <a
        href={typeof to === 'string' ? to : '#'}
        data-params={params != null ? JSON.stringify(params) : undefined}
        {...props}
      >
        {children}
      </a>
    ),
  }
})

const PROJECT_ID = 'aaaa0000-0000-0000-0000-000000000000'
const PROJECT_URL = `https://tq.fohte.net/projects/${PROJECT_ID}`

const project = makeProjectDetail({
  id: PROJECT_ID,
  title: 'tq',
  description: 'Personal task manager',
})

function renderProjectUrlChip() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(projectUrlPreviewKeys.preview(PROJECT_ID), project)

  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectUrlChip data={{ id: PROJECT_ID }} raw={PROJECT_URL} />
    </QueryClientProvider>,
  )
}

describe('ProjectUrlChip', () => {
  it('shows the project title and description in the popup on hover', async () => {
    const user = userEvent.setup()
    renderProjectUrlChip()

    await user.hover(screen.getByText(project.title))

    const body = within(document.body)
    // The popup's fade-in animation can still be mid-transition right as the
    // text mounts, so wait for it to finish rather than checking visibility
    // the instant the text appears.
    await waitFor(() =>
      expect(body.getByText(project.description ?? '')).toBeVisible(),
    )
    const popup = body
      .getByText(project.description ?? '')
      .closest('[data-slot="preview-card-popup"]')
    if (!(popup instanceof HTMLElement)) {
      throw new Error('Expected the preview card popup to be in the DOM')
    }
    expect(within(popup).getByText(project.title)).toBeVisible()
  })
})
