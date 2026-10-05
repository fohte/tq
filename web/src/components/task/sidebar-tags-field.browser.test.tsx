import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { makeLabel } from '#components/label/label-test-fixtures'
import { SidebarTagsField } from '#components/task/sidebar-tags-field'
import { resetSessionOpenSettings } from '#hooks/session-open-settings-test-fixtures'
import { labelKeys } from '#lib/query-keys'

describe('SidebarTagsField', () => {
  it('suggests labels from the task context', async () => {
    resetSessionOpenSettings({ localContext: 'work' })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    queryClient.setQueryData(labelKeys.list({ context: 'work' }), [
      makeLabel({ id: 'work-label', name: 'work-only', context: 'work' }),
    ])
    queryClient.setQueryData(labelKeys.list({ context: 'personal' }), [
      makeLabel({ id: 'personal-label', name: 'personal-only' }),
    ])
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <SidebarTagsField taskId="task-id" context="personal" labels={[]} />
      </QueryClientProvider>,
    )

    await user.click(screen.getByRole('button', { name: '+ add tag' }))

    await waitFor(() => {
      expect(
        screen
          .getAllByRole('button', { name: /^#/ })
          .map((button) => button.innerText),
      ).toEqual(['#personal-only'])
    })
  })
})
