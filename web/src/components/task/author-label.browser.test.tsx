import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AuthorLabel } from '#components/task/author-label'

describe('AuthorLabel', () => {
  it('renders nothing for a human author', () => {
    const { container } = render(
      <AuthorLabel author={{ kind: 'human', agent: null }} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when author is missing', () => {
    const { container } = render(<AuthorLabel author={null} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('labels a service author with its kind and name', () => {
    const { container } = render(
      <AuthorLabel author={{ kind: 'service', agent: 'sample-service' }} />,
    )

    expect(container.textContent).toEqual('service: sample-service')
  })
})
