import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { makeGithubLink } from '#components/task/github-link-test-fixtures'
import { GithubLinksChipGroup } from '#components/task/github-links-chip-group'

const issueLink = makeGithubLink({
  id: 'link-issue',
  number: 412,
  kind: 'issue',
  state: 'open',
  title: 'Support multiple GitHub links per task',
  url: 'https://github.com/fohte/tq/issues/412',
})

const mergedPrLink = makeGithubLink({
  id: 'link-pr-436',
  number: 436,
  kind: 'pull_request',
  state: 'merged',
  title: 'api: allow associating multiple GitHub links with a task',
  url: 'https://github.com/fohte/tq/pull/436',
})

const openPrLink = makeGithubLink({
  id: 'link-pr-441',
  number: 441,
  kind: 'pull_request',
  state: 'open',
  title: 'web: show representative chip with +N and hover popup',
  url: 'https://github.com/fohte/tq/pull/441',
})

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
