import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import {
  issueLink,
  mergedPrLink,
  openPrLink,
} from '#components/task/github-link-test-fixtures'
import { GithubLinksChipGroup } from '#components/task/github-links-chip-group'

describe('GithubLinksChipGroup', () => {
  it('opens the popup on hover and shows all links', async () => {
    const user = userEvent.setup()
    render(
      <GithubLinksChipGroup links={[issueLink, mergedPrLink, openPrLink]} />,
    )

    await user.hover(screen.getByTestId('github-links-chip'))

    await waitFor(() => {
      expect(screen.getByText('GITHUB (3)')).toBeVisible()
    })
    expect(
      screen.getByText('Support multiple GitHub links per task'),
    ).toBeVisible()
    expect(
      screen.getByText(
        'api: allow associating multiple GitHub links with a task',
      ),
    ).toBeVisible()
    expect(
      screen.getByText('web: show representative chip with +N and hover popup'),
    ).toBeVisible()
  })
})
